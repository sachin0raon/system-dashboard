#!/bin/sh
# entrypoint.sh — Start FastAPI backend then Nginx in foreground

set -e

echo "Starting Pi Dashboard..."
echo "Backend: uvicorn on 127.0.0.1:8000"
echo "Frontend: nginx on :80"

# Start FastAPI backend in background
uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log &
UVICORN_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to start..."
for i in $(seq 1 15); do
    if wget -q -O /dev/null http://127.0.0.1:8000/api/health 2>/dev/null; then
        echo "Backend is ready."
        break
    fi
    sleep 1
done

# Start Nginx in foreground (keeps container alive)
echo "Starting Nginx..."
exec nginx -g "daemon off;"
