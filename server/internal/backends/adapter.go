package backends

import "context"

// BackendAdapter is the interface for backend implementations.
type BackendAdapter interface {
	Name() string
	Type() string // "memory", "redis", "postgres"
	URL() string
	Health(ctx context.Context) (*HealthStatus, error)
	Stats(ctx context.Context) (*BackendStats, error)
	Close() error
}

// HealthStatus represents a backend's health.
type HealthStatus struct {
	Status  string `json:"status"` // "ok", "degraded", "error"
	Message string `json:"message,omitempty"`
}

// BackendStats represents backend statistics.
type BackendStats struct {
	TotalJobs    int            `json:"total_jobs"`
	ActiveJobs   int            `json:"active_jobs"`
	QueueDepths  map[string]int `json:"queue_depths,omitempty"`
	WorkerCount  int            `json:"worker_count"`
}
