# ─── Stage 1: Build React Frontend ────────────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --prefer-offline

COPY frontend/ ./

ARG VITE_API_KEY
ENV VITE_API_KEY=${VITE_API_KEY}

RUN npm run build

# ─── Stage 2: Build Go Backend ─────────────────────────────────────────────────
FROM golang:1.23-bookworm AS backend-build

WORKDIR /app

COPY backend-go/go.mod backend-go/go.sum ./
RUN go mod download

COPY backend-go/ ./

# CGO_ENABLED=0 produces a fully static binary — no libc needed at runtime.
# -ldflags="-s -w" strips debug info to reduce binary size (~30% smaller).
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o dashboard .

# ─── Stage 3: Runtime (Nginx + Go binary) ──────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx wget systemd \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /app/dashboard /usr/local/bin/dashboard
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
