package api

import (
	"net/http"
	"time"

	"github.com/openjobspec/ojs-playground/server/internal/chaos"
	"github.com/openjobspec/ojs-playground/server/internal/httpjson"
	"github.com/openjobspec/ojs-playground/server/internal/sse"
)

// ChaosHandler handles chaos engineering endpoints.
type ChaosHandler struct {
	config      *chaos.Config
	broadcaster *sse.Broadcaster
}

// NewChaosHandler creates a new ChaosHandler.
func NewChaosHandler(config *chaos.Config, broadcaster *sse.Broadcaster) *ChaosHandler {
	return &ChaosHandler{config: config, broadcaster: broadcaster}
}

// Get handles GET /api/chaos.
func (h *ChaosHandler) Get(w http.ResponseWriter, r *http.Request) {
	WriteJSON(w, http.StatusOK, map[string]any{"chaos": h.config.Get()})
}

// Update handles PUT /api/chaos.
func (h *ChaosHandler) Update(w http.ResponseWriter, r *http.Request) {
	var req chaos.UpdateRequest
	if decodeErr := httpjson.Decode(w, r, &req, 64<<10, false); decodeErr != nil {
		WriteError(w, decodeErr.Status, decodeErr.Message)
		return
	}
	if req.FailNextN != nil && (*req.FailNextN < 0 || *req.FailNextN > 10_000) {
		WriteError(w, http.StatusBadRequest, "Field 'fail_next_n' is out of range.")
		return
	}
	if req.LatencyMs != nil && (*req.LatencyMs < 0 || *req.LatencyMs > 60_000) {
		WriteError(w, http.StatusBadRequest, "Field 'latency_ms' is out of range.")
		return
	}
	if len(req.PausedQueues) > httpjson.MaxStringListItems {
		WriteError(w, http.StatusRequestEntityTooLarge, "Field 'paused_queues' has too many items.")
		return
	}
	for _, queue := range req.PausedQueues {
		if len(queue) == 0 || len(queue) > httpjson.MaxQueueLength {
			WriteError(w, http.StatusBadRequest, "Field 'paused_queues' contains an invalid queue.")
			return
		}
	}
	if req.FailNextN == nil && req.LatencyMs == nil && req.TimeoutNext == nil && req.PausedQueues == nil {
		WriteError(w, http.StatusBadRequest, "At least one chaos setting is required.")
		return
	}

	h.config.Update(req)

	if h.broadcaster != nil {
		h.broadcaster.Broadcast(sse.Event{
			Type:      sse.EventChaosActivated,
			Timestamp: time.Now(),
			Data:      h.config.Get(),
		})
	}

	WriteJSON(w, http.StatusOK, map[string]any{"chaos": h.config.Get()})
}

// Reset handles DELETE /api/chaos.
func (h *ChaosHandler) Reset(w http.ResponseWriter, r *http.Request) {
	h.config.Reset()
	WriteJSON(w, http.StatusOK, map[string]any{"chaos": h.config.Get()})
}
