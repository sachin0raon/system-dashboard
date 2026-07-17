package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"sys-dash/logs"
	"sys-dash/metrics"
	"sys-dash/ws"
)

func main() {
	_ = godotenv.Load()

	apiKey := os.Getenv("API_KEY")
	if apiKey == "" {
		slog.Error("API_KEY environment variable is not set")
		os.Exit(1)
	}

	allowedOrigins := strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",")
	if len(allowedOrigins) == 0 || allowedOrigins[0] == "" {
		allowedOrigins = []string{"*"}
	}

	// Load static OS info once — never recomputed during the process lifetime.
	static := metrics.LoadStaticInfo()
	state := metrics.NewState()
	hub := ws.NewHub()

	// Warm up: initial collection seeds the delta baselines and caches the
	// first snapshot so /api/metrics responds immediately on first request.
	_, data := metrics.Collect(static, state)
	hub.StoreSnapshot(metrics.SystemMetrics{}, data)

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"GET"},
		AllowedHeaders: []string{"X-API-Key", "Content-Type"},
	}))

	// Public endpoints
	r.Get("/api/health", handleHealth())

	// Protected endpoints (X-API-Key header)
	r.Group(func(r chi.Router) {
		r.Use(apiKeyMiddleware(apiKey))
		r.Get("/api/metrics", handleMetrics(hub))
		r.Get("/api/logs", logs.HandleLogs())
		r.Get("/api/logs/units", logs.HandleUnits())
		r.Get("/api/services", handleServices())
	})

	// WebSocket (auth via ?token= query param)
	r.Get("/ws/metrics", hub.HandleWebSocket(apiKey))

	// Start the single broadcast goroutine.
	go hub.BroadcastLoop(static, state, 2*time.Second)

	srv := &http.Server{
		Addr:         "127.0.0.1:8000",
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		slog.Info("Dashboard backend listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	<-quit
	slog.Info("Shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "err", err)
	}
}

// handleHealth is public — no API key required.
func handleHealth() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":    "ok",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}
}

// handleMetrics serves the last cached snapshot — zero recomputation.
func handleMetrics(h *ws.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data := h.LastSnapshotJSON()
		if data == nil {
			http.Error(w, `{"detail":"metrics not ready yet"}`, http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	}
}

// handleServices reads running services from cgroup sysfs — no subprocess.
func handleServices() http.HandlerFunc {
	slices := []string{
		"/sys/fs/cgroup/system.slice",          // cgroup v2 (Bookworm)
		"/sys/fs/cgroup/systemd/system.slice",  // cgroup v1 fallback
	}
	return func(w http.ResponseWriter, r *http.Request) {
		seen := make(map[string]struct{})
		for _, slice := range slices {
			entries, err := os.ReadDir(slice)
			if err != nil {
				continue
			}
			for _, e := range entries {
				if e.IsDir() && strings.HasSuffix(e.Name(), ".service") {
					seen[e.Name()] = struct{}{}
				}
			}
		}

		services := make([]string, 0, len(seen))
		for name := range seen {
			services = append(services, name)
		}
		// Simple sort
		for i := 1; i < len(services); i++ {
			for j := i; j > 0 && services[j] < services[j-1]; j-- {
				services[j], services[j-1] = services[j-1], services[j]
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"services": services})
	}
}

// apiKeyMiddleware checks the X-API-Key header on all protected routes.
func apiKeyMiddleware(key string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("X-API-Key") != key {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				w.Write([]byte(`{"detail":"Invalid or missing X-API-Key header."}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
