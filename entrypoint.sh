#!/bin/sh
# entrypoint.sh — Start Go backend then Nginx in foreground

set -e

echo "Starting Pi Dashboard..."
echo "Backend: Go binary on 127.0.0.1:8000"
echo "Frontend: nginx on :80"

# Start Go backend in background
/usr/local/bin/dashboard &
BACKEND_PID=$!

# Wait for backend to be ready (Go starts in ~20ms, but give it 5s to be safe)
echo "Waiting for backend to start..."
for i in $(seq 1 5); do
    if wget -q -O /dev/null http://127.0.0.1:8000/api/health 2>/dev/null; then
        echo "Backend is ready."
        break
    fi
    sleep 1
done

# Start Nginx in foreground (keeps container alive)
echo "Starting Nginx..."
exec nginx -g "daemon off;"
