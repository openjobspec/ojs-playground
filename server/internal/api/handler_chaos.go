package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/openjobspec/ojs-playground/server/internal/chaos"
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
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
