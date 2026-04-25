# ─── Stage 1: Build React Frontend ────────────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

# Install deps first (cache layer)
COPY frontend/package*.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY frontend/ ./

# Build-time env vars (API key baked into frontend bundle)
ARG VITE_API_KEY
ENV VITE_API_KEY=${VITE_API_KEY}

RUN npm run build

# ─── Stage 2: Runtime (Nginx + Python/FastAPI) ─────────────────────────────────
FROM python:3.12-slim AS runtime

# Install Nginx
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx wget \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ── Backend setup ─────────────────────────────────────────────────────────────
WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/main.py ./

# ── Frontend build output ─────────────────────────────────────────────────────
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# ── Nginx config ──────────────────────────────────────────────────────────────
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# ── Entrypoint ────────────────────────────────────────────────────────────────
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose only port 80 — Nginx handles everything
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
