"""
Pi 5 Dashboard — FastAPI Backend
==================================
Reads system metrics via psutil and exposes them on /api/metrics.
All endpoints are protected by an X-API-Key header.
"""

from __future__ import annotations

import asyncio
import os
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

import psutil
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Security, status, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel

# ─── Environment ───────────────────────────────────────────────────────────────
load_dotenv()

API_KEY = os.environ.get("API_KEY", "")
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")

if not API_KEY:
    raise RuntimeError(
        "API_KEY environment variable is not set. "
        "Set it in your .env file or Docker environment."
    )

# ─── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Pi 5 Dashboard API",
    description="System metrics API for Raspberry Pi 5 dashboard",
    version="1.0.0",
    docs_url=None,   # Disable Swagger UI in production
    redoc_url=None,  # Disable ReDoc in production
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["X-API-Key", "Content-Type"],
)

# ─── Auth ──────────────────────────────────────────────────────────────────────
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(key: Optional[str] = Security(api_key_header)) -> str:
    if key is None or key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing X-API-Key header.",
        )
    return key


async def verify_ws_token(websocket: WebSocket, token: Optional[str] = Query(None)) -> bool:
    if token is None or token != API_KEY:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or missing token")
        return False
    return True

# ─── WebSocket Manager ────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, metrics: SystemMetrics):
        import json
        data = metrics.model_dump_json()
        dead_connections = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(data)
            except Exception:
                dead_connections.add(connection)
        for dead in dead_connections:
            self.disconnect(dead)

manager = ConnectionManager()


# ─── Pydantic Models ───────────────────────────────────────────────────────────

class CpuInfo(BaseModel):
    usage_percent: float
    per_core_percent: List[float]
    frequency_mhz: float
    core_count: int
    thread_count: int


class MemoryInfo(BaseModel):
    total_bytes: int
    used_bytes: int
    available_bytes: int
    percent: float
    swap_total_bytes: int
    swap_used_bytes: int
    swap_percent: float


class DiskPartition(BaseModel):
    device: str
    mountpoint: str
    fstype: str
    total_bytes: int
    used_bytes: int
    free_bytes: int
    percent: float


class DiskInfo(BaseModel):
    partitions: List[DiskPartition]
    read_bytes_per_sec: float
    write_bytes_per_sec: float


class TemperatureInfo(BaseModel):
    cpu_celsius: Optional[float]
    gpu_celsius: Optional[float]
    sensors: Dict[str, float]
    is_under_voltage: bool = False
    is_throttled: bool = False
    freq_capped: bool = False
    soft_temp_limit: bool = False


class NetworkInterface(BaseModel):
    name: str
    bytes_sent_per_sec: float
    bytes_recv_per_sec: float
    bytes_sent_total: int
    bytes_recv_total: int
    ip_address: Optional[str]


class NetworkInfo(BaseModel):
    interfaces: List[NetworkInterface]


class OsInfo(BaseModel):
    hostname: str
    os_name: str
    os_version: str
    kernel: str
    architecture: str
    uptime_seconds: float
    boot_time: str
    load_avg_1: float
    load_avg_5: float
    load_avg_15: float
    process_count: int


class ProcessInfo(BaseModel):
    pid: int
    name: str
    cpu_percent: float
    memory_percent: float
    username: str


class SystemMetrics(BaseModel):
    cpu: CpuInfo
    memory: MemoryInfo
    disk: DiskInfo
    temperature: TemperatureInfo
    network: NetworkInfo
    os: OsInfo
    processes_cpu: List[ProcessInfo]
    processes_memory: List[ProcessInfo]
    timestamp: str


# ─── State for delta calculations ─────────────────────────────────────────────
_prev_disk_io: Optional[psutil._common.sdiskio] = None   # type: ignore[name-defined]
_prev_disk_time: float = 0.0
_prev_net_io: Optional[Dict[str, psutil._common.snetio]] = None  # type: ignore[name-defined]
_prev_net_time: float = 0.0
_process_cache: Dict[int, psutil.Process] = {}


# ─── Metric Collectors ────────────────────────────────────────────────────────

def _get_cpu() -> CpuInfo:
    freq = psutil.cpu_freq()
    # Using interval=None avoids blocking the FastAPI event loop for 100ms.
    # It returns usage since the last call to cpu_percent in this process.
    return CpuInfo(
        usage_percent=psutil.cpu_percent(interval=None),
        per_core_percent=psutil.cpu_percent(interval=None, percpu=True),  # type: ignore[arg-type]
        frequency_mhz=freq.current if freq else 0.0,
        core_count=psutil.cpu_count(logical=False) or 1,
        thread_count=psutil.cpu_count(logical=True) or 1,
    )


def _get_memory() -> MemoryInfo:
    vm = psutil.virtual_memory()
    sw = psutil.swap_memory()
    return MemoryInfo(
        total_bytes=vm.total,
        used_bytes=vm.used,
        available_bytes=vm.available,
        percent=vm.percent,
        swap_total_bytes=sw.total,
        swap_used_bytes=sw.used,
        swap_percent=sw.percent,
    )


def _get_disk() -> DiskInfo:
    global _prev_disk_io, _prev_disk_time

    partitions = []
    for p in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(p.mountpoint)
            partitions.append(
                DiskPartition(
                    device=p.device,
                    mountpoint=p.mountpoint,
                    fstype=p.fstype,
                    total_bytes=usage.total,
                    used_bytes=usage.used,
                    free_bytes=usage.free,
                    percent=usage.percent,
                )
            )
        except (PermissionError, OSError):
            continue

    # Disk I/O delta
    read_bps = write_bps = 0.0
    now = time.monotonic()
    try:
        cur_io = psutil.disk_io_counters()
        if _prev_disk_io is not None and cur_io is not None:
            dt = now - _prev_disk_time
            if dt > 0:
                read_bps = (cur_io.read_bytes - _prev_disk_io.read_bytes) / dt
                write_bps = (cur_io.write_bytes - _prev_disk_io.write_bytes) / dt
        _prev_disk_io = cur_io
        _prev_disk_time = now
    except (OSError, PermissionError):
        pass

    return DiskInfo(
        partitions=partitions,
        read_bytes_per_sec=max(read_bps, 0),
        write_bytes_per_sec=max(write_bps, 0),
    )


def _get_temperature() -> TemperatureInfo:
    cpu_celsius: Optional[float] = None
    gpu_celsius: Optional[float] = None
    sensors: Dict[str, float] = {}

    is_under_voltage = False
    is_throttled = False
    freq_capped = False
    soft_temp_limit = False

    try:
        import subprocess
        out = subprocess.check_output(["vcgencmd", "get_throttled"], text=True)
        # e.g., throttled=0x50000
        val_str = out.strip().split("=")[1]
        val = int(val_str, 16)
        is_under_voltage = bool(val & 1)
        freq_capped = bool(val & 2)
        is_throttled = bool(val & 4)
        soft_temp_limit = bool(val & 8)
    except Exception:
        pass

    try:
        all_temps = psutil.sensors_temperatures()
        for name, entries in all_temps.items():
            for entry in entries:
                label = entry.label or name
                sensors[f"{name}/{label}"] = entry.current

                # Raspberry Pi CPU thermal zone
                if name in ("cpu_thermal", "cpu-thermal", "coretemp") and cpu_celsius is None:
                    cpu_celsius = entry.current

            # Pi GPU: check for `ISP` or `vcgencmd` style labels
            if name in ("gpu_thermal", "gpu-thermal") and gpu_celsius is None:
                gpu_celsius = entries[0].current if entries else None

    except (AttributeError, OSError):
        # Some platforms don't support sensors_temperatures
        pass

    # Fallback for Pi using /sys/class/thermal
    if cpu_celsius is None:
        try:
            with open("/sys/class/thermal/thermal_zone0/temp") as f:
                cpu_celsius = int(f.read().strip()) / 1000.0
        except (OSError, ValueError):
            pass

    # GPU Temp Fallback for Pi in Docker
    if gpu_celsius is None:
        try:
            import subprocess
            out = subprocess.check_output(["vcgencmd", "measure_temp"], text=True)
            gpu_celsius = float(out.split("=")[1].replace("'C\n", "").replace("'C", ""))
        except Exception:
            # On Raspberry Pi, the CPU and GPU are physically on the same SoC die.
            # If vcgencmd isn't available (e.g., inside Docker container), 
            # we safely fall back to the CPU temp.
            gpu_celsius = cpu_celsius

    return TemperatureInfo(
        cpu_celsius=cpu_celsius,
        gpu_celsius=gpu_celsius,
        sensors=sensors,
        is_under_voltage=is_under_voltage,
        is_throttled=is_throttled,
        freq_capped=freq_capped,
        soft_temp_limit=soft_temp_limit,
    )


def _get_network() -> NetworkInfo:
    global _prev_net_io, _prev_net_time

    interfaces = []
    now = time.monotonic()

    try:
        cur_net = psutil.net_io_counters(pernic=True)
        addrs = psutil.net_if_addrs()
        dt = now - _prev_net_time if _prev_net_io else 0

        for name, stats in cur_net.items():
            sent_bps = recv_bps = 0.0
            if _prev_net_io and name in _prev_net_io and dt > 0:
                sent_bps = (stats.bytes_sent - _prev_net_io[name].bytes_sent) / dt
                recv_bps = (stats.bytes_recv - _prev_net_io[name].bytes_recv) / dt

            # Get first IPv4 address
            ip = None
            for addr in addrs.get(name, []):
                if addr.family.name == "AF_INET":
                    ip = addr.address
                    break

            interfaces.append(
                NetworkInterface(
                    name=name,
                    bytes_sent_per_sec=max(sent_bps, 0),
                    bytes_recv_per_sec=max(recv_bps, 0),
                    bytes_sent_total=stats.bytes_sent,
                    bytes_recv_total=stats.bytes_recv,
                    ip_address=ip,
                )
            )

        _prev_net_io = cur_net
        _prev_net_time = now
    except (OSError, PermissionError):
        pass

    return NetworkInfo(interfaces=interfaces)


def _get_os() -> OsInfo:
    import platform
    import socket

    boot_ts = psutil.boot_time()
    uptime = time.time() - boot_ts
    load = psutil.getloadavg()

    uname = platform.uname()

    try:
        hostname = socket.gethostname()
    except Exception:
        hostname = uname.node

    # Try to get a readable OS version
    try:
        with open("/etc/os-release") as f:
            os_release = dict(
                line.strip().split("=", 1) for line in f if "=" in line
            )
        os_name = os_release.get("NAME", uname.system).strip('"')
        os_version = os_release.get("VERSION_ID", uname.release).strip('"')
    except Exception:
        os_name = uname.system
        os_version = uname.version

    return OsInfo(
        hostname=hostname,
        os_name=os_name,
        os_version=os_version,
        kernel=uname.release,
        architecture=uname.machine,
        uptime_seconds=uptime,
        boot_time=datetime.fromtimestamp(boot_ts, tz=timezone.utc).isoformat(),
        load_avg_1=load[0],
        load_avg_5=load[1],
        load_avg_15=load[2],
        process_count=len(psutil.pids()),
    )


def _get_processes(limit: int = 5) -> Dict[str, List[ProcessInfo]]:
    global _process_cache
    current_pids = set(psutil.pids())

    _process_cache = {pid: p for pid, p in _process_cache.items() if pid in current_pids}

    proc_list = []
    for pid in current_pids:
        try:
            if pid not in _process_cache:
                _process_cache[pid] = psutil.Process(pid)

            p = _process_cache[pid]
            cpu = p.cpu_percent(interval=None)
            mem = p.memory_percent()

            proc_list.append((pid, p.name(), cpu, mem, p.username()))
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, OSError):
            pass

    # Sort by CPU
    proc_list.sort(key=lambda x: x[2], reverse=True)
    top_cpu = proc_list[:limit]

    # Sort by Memory
    proc_list.sort(key=lambda x: x[3], reverse=True)
    top_mem = proc_list[:limit]

    def to_info(lst):
        return [
            ProcessInfo(
                pid=p[0],
                name=p[1],
                cpu_percent=round(p[2], 1),
                memory_percent=round(p[3], 1),
                username=p[4]
            )
            for p in lst
        ]

    return {
        "cpu": to_info(top_cpu),
        "memory": to_info(top_mem)
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get(
    "/api/metrics",
    response_model=SystemMetrics,
    summary="Get all system metrics",
    dependencies=[Security(verify_api_key)],
)
async def get_metrics() -> SystemMetrics:
    """
    Returns a snapshot of all system metrics:
    CPU, memory, disk, temperature, network, and OS details.
    Requires a valid `X-API-Key` header.
    """
    return SystemMetrics(
        cpu=_get_cpu(),
        memory=_get_memory(),
        disk=_get_disk(),
        temperature=_get_temperature(),
        network=_get_network(),
        os=_get_os(),
        processes_cpu=(procs := _get_processes())["cpu"],
        processes_memory=procs["memory"],
        timestamp=datetime.now(tz=timezone.utc).isoformat(),
    )


@app.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket, token: Optional[str] = Query(None)):
    """
    WebSocket endpoint for real-time metrics streaming.
    Requires `token=API_KEY` in the query parameters.
    """
    if not await verify_ws_token(websocket, token):
        return

    await manager.connect(websocket)
    try:
        # We can optionally send an immediate initial snapshot
        metrics = SystemMetrics(
            cpu=_get_cpu(),
            memory=_get_memory(),
            disk=_get_disk(),
            temperature=_get_temperature(),
            network=_get_network(),
            os=_get_os(),
            processes_cpu=(procs := _get_processes())["cpu"],
            processes_memory=procs["memory"],
            timestamp=datetime.now(tz=timezone.utc).isoformat(),
        )
        await websocket.send_text(metrics.model_dump_json())
        
        # Keep connection open. The actual data is pumped out by `broadcast_metrics_loop`
        while True:
            # We don't expect messages from the client. Just wait or parse pings.
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


async def broadcast_metrics_loop():
    """Background task that ticks every 2 seconds to broadcast metrics to all connected WS clients."""
    while True:
        if manager.active_connections:
            try:
                metrics = SystemMetrics(
                    cpu=_get_cpu(),
                    memory=_get_memory(),
                    disk=_get_disk(),
                    temperature=_get_temperature(),
                    network=_get_network(),
                    os=_get_os(),
                    processes_cpu=(procs := _get_processes())["cpu"],
                    processes_memory=procs["memory"],
                    timestamp=datetime.now(tz=timezone.utc).isoformat(),
                )
                await manager.broadcast(metrics)
            except Exception as e:
                print(f"Error gathering metrics for broadcast: {e}")
        
        # Exact 2-second tick (could stagger slightly if collection is slow, but acceptable)
        await asyncio.sleep(2.0)

@app.on_event("startup")
async def startup_event():
    # Start the broadcast loop entirely in the background
    asyncio.create_task(broadcast_metrics_loop())


@app.get("/api/health", summary="Health check (no auth required)")
async def health() -> dict:
    return {"status": "ok", "timestamp": datetime.now(tz=timezone.utc).isoformat()}
