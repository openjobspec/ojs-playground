package backends

import (
	"context"
	"fmt"
	"sync"
)

// Manager manages multiple backend adapters and provides the active backend.
type Manager struct {
	mu       sync.RWMutex
	backends map[string]BackendAdapter
	active   string
}

// NewManager creates a new Manager with the given active backend name.
func NewManager(active string) *Manager {
	return &Manager{
		backends: make(map[string]BackendAdapter),
		active:   active,
	}
}

// Register adds a backend adapter.
func (m *Manager) Register(adapter BackendAdapter) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.backends[adapter.Name()] = adapter
}

// Active returns the currently active backend.
func (m *Manager) Active() (BackendAdapter, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	b, ok := m.backends[m.active]
	if !ok {
		return nil, fmt.Errorf("backend %q not found", m.active)
	}
	return b, nil
}

// ActiveName returns the name of the active backend.
func (m *Manager) ActiveName() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.active
}

// Get returns a backend by name.
func (m *Manager) Get(name string) (BackendAdapter, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	b, ok := m.backends[name]
	return b, ok
}

// List returns all registered backends.
func (m *Manager) List() []BackendInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var infos []BackendInfo
	for name, b := range m.backends {
		infos = append(infos, BackendInfo{
			Name:   name,
			Type:   b.Type(),
			URL:    b.URL(),
			Active: name == m.active,
		})
	}
	return infos
}

// BackendInfo is a summary of a registered backend.
type BackendInfo struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	URL    string `json:"url"`
	Active bool   `json:"active"`
}

// HealthAll checks health of all backends.
func (m *Manager) HealthAll(ctx context.Context) map[string]*HealthStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()

	results := make(map[string]*HealthStatus)
	for name, b := range m.backends {
		h, err := b.Health(ctx)
		if err != nil {
			results[name] = &HealthStatus{Status: "error", Message: err.Error()}
		} else {
			results[name] = h
		}
	}
	return results
}

// Close closes all backends.
func (m *Manager) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var firstErr error
	for _, b := range m.backends {
		if err := b.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}
