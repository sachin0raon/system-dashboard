package ws

import (
	"log/slog"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"sys-dash/metrics"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// Hub manages all active WebSocket connections and the single broadcast loop.
type Hub struct {
	mu          sync.RWMutex
	connections map[*websocket.Conn]struct{}

	// lastSnapshot stores the pre-serialised JSON []byte so the HTTP /api/metrics
	// endpoint can serve it without re-marshaling. Uses atomic pointer for
	// lock-free reads from HTTP handlers.
	lastSnapshot atomic.Pointer[[]byte]
}

func NewHub() *Hub {
	return &Hub{
		connections: make(map[*websocket.Conn]struct{}),
	}
}

// StoreSnapshot saves a new metrics snapshot (called from broadcast loop and at startup).
func (h *Hub) StoreSnapshot(_ metrics.SystemMetrics, data []byte) {
	// Store a copy so the broadcast loop can reuse the original slice.
	cp := make([]byte, len(data))
	copy(cp, data)
	h.lastSnapshot.Store(&cp)
}

// LastSnapshotJSON returns the most recent JSON snapshot, or nil if none yet.
func (h *Hub) LastSnapshotJSON() []byte {
	p := h.lastSnapshot.Load()
	if p == nil {
		return nil
	}
	return *p
}

// BroadcastLoop runs forever; call it in a dedicated goroutine.
//
// When clients are connected: collects and broadcasts at every tick (full rate).
// When no clients: skips collection on 14 out of every 15 ticks (~30s at 2s
// interval) to avoid burning CPU on the Pi when nobody is watching the dashboard.
// The snapshot is still refreshed every 30s so the HTTP /api/metrics endpoint
// doesn't serve data that is arbitrarily stale on first page load.
func (h *Hub) BroadcastLoop(static *metrics.StaticInfo, state *metrics.State, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// backgroundEvery controls how often to collect when idle.
	// 15 ticks × 2s = 30s background refresh rate.
	const backgroundEvery = 15
	var tick uint64

	for range ticker.C {
		tick++

		h.mu.RLock()
		hasClients := len(h.connections) > 0
		h.mu.RUnlock()

		// Skip the expensive collection when no one is watching,
		// except every backgroundEvery ticks to keep the snapshot warm.
		if !hasClients && tick%backgroundEvery != 0 {
			continue
		}

		_, data := metrics.Collect(static, state)
		h.StoreSnapshot(metrics.SystemMetrics{}, data)

		if hasClients {
			h.broadcast(data)
		}
	}
}

func (h *Hub) broadcast(data []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	deadline := time.Now().Add(5 * time.Second)
	for conn := range h.connections {
		conn.SetWriteDeadline(deadline)
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			conn.Close()
			delete(h.connections, conn)
		}
	}
}

// HandleWebSocket returns an http.HandlerFunc that upgrades the connection,
// immediately sends the current snapshot, and registers the connection in the hub.
func (h *Hub) HandleWebSocket(apiKey string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("token") != apiKey {
			http.Error(w, `{"detail":"Invalid or missing token"}`, http.StatusForbidden)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Warn("WebSocket upgrade failed", "err", err)
			return
		}

		// Send the cached snapshot immediately so the client sees data right away.
		if snap := h.LastSnapshotJSON(); snap != nil {
			conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, snap); err != nil {
				conn.Close()
				return
			}
		}

		h.mu.Lock()
		h.connections[conn] = struct{}{}
		h.mu.Unlock()

		// Read loop: drain incoming frames (ping/pong) and detect close.
		go func() {
			defer func() {
				h.mu.Lock()
				delete(h.connections, conn)
				h.mu.Unlock()
				conn.Close()
			}()
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					return
				}
			}
		}()
	}
}

// ConnectionCount returns the number of active WebSocket connections.
// Exported for health/debug endpoints.
func (h *Hub) ConnectionCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.connections)
}
