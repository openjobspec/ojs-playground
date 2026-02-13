package api

import (
	"net/http"
	"time"
)

const version = "0.1.0"

var startTime = time.Now()

// HealthHandler handles the health check endpoint.
type HealthHandler struct {
	port     int
	backends []string
}

// NewHealthHandler creates a new HealthHandler.
func NewHealthHandler(port int, backends []string) *HealthHandler {
	return &HealthHandler{port: port, backends: backends}
}

// Health handles GET /api/health.
func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	WriteJSON(w, http.StatusOK, map[string]any{
		"status":     "ok",
		"version":    version,
		"uptime_ms":  time.Since(startTime).Milliseconds(),
		"port":       h.port,
		"backends":   h.backends,
		"workers":    map[string]any{"connected": 0, "total": 0},
		"started_at": startTime.UTC().Format(time.RFC3339),
	})
}
