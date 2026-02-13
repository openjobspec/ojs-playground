package history

import (
	"context"
	"encoding/json"
	"time"
)

// Job represents a job record in the history store.
type Job struct {
	ID          string          `json:"id"`
	Type        string          `json:"type"`
	State       string          `json:"state"`
	Queue       string          `json:"queue"`
	Args        json.RawMessage `json:"args"`
	Meta        json.RawMessage `json:"meta,omitempty"`
	Priority    int             `json:"priority"`
	Attempt     int             `json:"attempt"`
	MaxAttempts int             `json:"max_attempts"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	Backend     string          `json:"backend"`
	Result      json.RawMessage `json:"result,omitempty"`
	Error       json.RawMessage `json:"error,omitempty"`
}

// StateChange represents a single state transition in a job's history.
type StateChange struct {
	FromState string    `json:"from_state"`
	ToState   string    `json:"to_state"`
	Timestamp time.Time `json:"timestamp"`
	Reason    string    `json:"reason,omitempty"`
}

// ListFilter specifies filters for listing jobs.
type ListFilter struct {
	State  string
	Type   string
	Queue  string
	Limit  int
	Offset int
}

// Store defines the interface for job history persistence.
type Store interface {
	SaveJob(ctx context.Context, job *Job) error
	UpdateJobState(ctx context.Context, jobID, fromState, toState, reason string) error
	GetJob(ctx context.Context, jobID string) (*Job, error)
	ListJobs(ctx context.Context, filter ListFilter) ([]*Job, int, error)
	GetJobHistory(ctx context.Context, jobID string) ([]StateChange, error)
	Close() error
}
