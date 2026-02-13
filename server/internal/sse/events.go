package sse

import "time"

// Event types.
const (
	EventJobStateChanged    = "job:state_changed"
	EventJobCompleted       = "job:completed"
	EventJobFailed          = "job:failed"
	EventJobDead            = "job:dead"
	EventWorkerConnected    = "worker:connected"
	EventWorkerDisconnected = "worker:disconnected"
	EventChaosActivated     = "chaos:activated"
	EventKeepalive          = "keepalive"
)

// Event represents a server-sent event.
type Event struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Data      any       `json:"data"`
	Timestamp time.Time `json:"timestamp"`

	// Filtering fields (not serialized)
	JobID string `json:"-"`
	Queue string `json:"-"`
}
