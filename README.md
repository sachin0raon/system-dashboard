# Pi 5 Telemetry Dashboard

A beautiful, modern, glassmorphic system monitoring dashboard for Raspberry Pi 5.

**Stack:** React 19 + TypeScript + Tailwind CSS 4 + Framer Motion (frontend) · FastAPI + psutil (backend) · Nginx (reverse proxy) · Docker (single container)

---

## Quick Start (Docker — Recommended)

### 1. Create backend `.env`

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set a strong API_KEY
nano backend/.env
```

### 2. Build and run

```bash
# Build and start (API_KEY is passed as a build arg for the frontend bundle)
API_KEY=$(grep API_KEY backend/.env | cut -d= -f2) docker compose up -d --build
```

Or explicitly:

```bash
docker compose build --build-arg VITE_API_KEY=your-secret-key
docker compose up -d
```

### 3. Access

Open `http://<your-pi-ip>` in a browser.

---

## Security

| Layer | Mechanism |
|---|---|
| **Authentication** | `X-API-Key` header on all `/api/*` routes |
| **Rate limiting** | Nginx: 30 req/min per IP on `/api` |
| **Security headers** | `X-Frame-Options`, `X-Content-Type-Options`, `CSP`, etc. |
| **No info leakage** | Nginx version hidden, Swagger UI disabled |
| **CORS** | Configurable via `ALLOWED_ORIGINS` env var |

> ⚠️ For public internet exposure, put this behind a reverse proxy (Cloudflare / Caddy / Nginx) with **HTTPS (TLS)**.

---

## Local Development (without Docker)

### Backend

```bash
cd backend
cp .env.example .env  # Set API_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
# .env.local already created — edit VITE_API_KEY to match backend
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` → `http://localhost:8000`.

---

## Project Structure

```
rpi-dash/
├── frontend/                    # React 19 + Vite + Tailwind CSS 4
│   ├── src/
│   │   ├── api/queries.ts       # React Query hooks (useSystemMetrics)
│   │   ├── components/
│   │   │   ├── ui/              # GlassCard, MetricBar, StatValue
│   │   │   ├── widgets/         # CpuCard, MemoryCard, DiskCard, TempCard, NetworkCard, OsCard
│   │   │   ├── Header.tsx
│   │   │   └── LoadingStates.tsx
│   │   ├── lib/utils.ts         # cn, formatBytes, status color helpers
│   │   ├── types/metrics.ts     # TypeScript types matching FastAPI models
│   │   ├── App.tsx
│   │   └── index.css            # Design tokens + glass utilities
│   └── .env.local               # VITE_API_KEY for local dev
├── backend/
│   ├── main.py                  # FastAPI app with psutil collectors
│   ├── requirements.txt
│   └── .env.example             # Copy to .env and set API_KEY
├── nginx/
│   └── nginx.conf               # Serves SPA + proxies /api, security headers
├── Dockerfile                   # Multi-stage: Node build → Python runtime
├── docker-compose.yml
├── entrypoint.sh                # Starts uvicorn, waits for health, then nginx
└── .dockerignore
```

---

## Monitored Metrics

| Widget | Metrics |
|---|---|
| **CPU** | Overall %, per-core %, frequency, core/thread count |
| **Memory** | RAM used/total/%, swap used/total/% |
| **Temperature** | CPU °C, GPU °C (Pi thermal zones), all sensors |
| **Disk** | Per-partition usage %, read/write bytes/sec |
| **Network** | Per-interface recv/sent bytes/sec + totals, IP address |
| **System** | Hostname, OS, kernel, architecture, uptime, load averages, process count |
