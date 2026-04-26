/** API types matching the FastAPI backend response */

export interface CpuInfo {
  usage_percent: number;
  per_core_percent: number[];
  frequency_mhz: number;
  core_count: number;
  thread_count: number;
}

export interface MemoryInfo {
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  percent: number;
  swap_total_bytes: number;
  swap_used_bytes: number;
  swap_percent: number;
}

export interface DiskPartition {
  device: string;
  mountpoint: string;
  fstype: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  percent: number;
}

export interface DiskInfo {
  partitions: DiskPartition[];
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
}

export interface TemperatureInfo {
  cpu_celsius: number | null;
  gpu_celsius: number | null;
  fan_speed_rpm?: number | null;
  sensors: Record<string, number>;
  is_under_voltage: boolean;
  is_throttled: boolean;
  freq_capped: boolean;
  soft_temp_limit: boolean;
}

export interface NetworkInterface {
  name: string;
  bytes_sent_per_sec: number;
  bytes_recv_per_sec: number;
  bytes_sent_total: number;
  bytes_recv_total: number;
  ip_address: string | null;
}

export interface NetworkInfo {
  interfaces: NetworkInterface[];
}

export interface OsInfo {
  hostname: string;
  os_name: string;
  os_version: string;
  kernel: string;
  architecture: string;
  uptime_seconds: number;
  boot_time: string;
  load_avg_1: number;
  load_avg_5: number;
  load_avg_15: number;
  process_count: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
  username: string;
  cmdline: string;       // truncated command string (max 120 chars)
  create_time: number;   // epoch seconds — used to compute uptime
  ppid: number;          // parent PID (0 = root/unknown)
  num_threads: number;
}

export interface SystemMetrics {
  cpu: CpuInfo;
  memory: MemoryInfo;
  disk: DiskInfo;
  temperature: TemperatureInfo;
  network: NetworkInfo;
  os: OsInfo;
  processes_cpu: ProcessInfo[];
  processes_memory: ProcessInfo[];
  timestamp: string;
}
