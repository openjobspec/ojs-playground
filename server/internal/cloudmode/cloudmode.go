// Package cloudmode manages ephemeral tenant provisioning for the OJS Playground.
//
// When "Cloud Mode" is enabled, the Playground connects to an OJS Cloud instance
// and provisions temporary tenants that auto-expire after a configurable TTL.
package cloudmode

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Config holds cloud mode configuration.
type Config struct {
	Enabled     bool          `json:"enabled"`
	CloudURL    string        `json:"cloud_url"`    // OJS Cloud gateway URL
	AdminKey    string        `json:"admin_key"`    // OJS Cloud admin API key
	TenantTTL   time.Duration `json:"tenant_ttl"`   // auto-cleanup after this duration
	MaxTenants  int           `json:"max_tenants"`  // concurrent ephemeral tenants
}

// EphemeralTenant represents a temporary playground tenant.
type EphemeralTenant struct {
	ID        string    `json:"id"`
	APIKey    string    `json:"api_key"`
	Endpoint  string    `json:"endpoint"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// Manager handles ephemeral tenant lifecycle.
type Manager struct {
	mu      sync.RWMutex
	config  Config
	tenants map[string]*EphemeralTenant
	client  *http.Client
}

// NewManager creates a cloud mode manager.
func NewManager(cfg Config) *Manager {
	if cfg.TenantTTL <= 0 {
		cfg.TenantTTL = 1 * time.Hour
	}
	if cfg.MaxTenants <= 0 {
		cfg.MaxTenants = 100
	}
	return &Manager{
		config:  cfg,
		tenants: make(map[string]*EphemeralTenant),
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

// IsEnabled returns whether cloud mode is active.
func (m *Manager) IsEnabled() bool {
	return m.config.Enabled && m.config.CloudURL != ""
}

// Provision creates a new ephemeral tenant.
func (m *Manager) Provision(sessionID string) (*EphemeralTenant, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.tenants) >= m.config.MaxTenants {
		m.cleanup() // try cleaning expired first
		if len(m.tenants) >= m.config.MaxTenants {
			return nil, fmt.Errorf("max ephemeral tenants reached (%d)", m.config.MaxTenants)
		}
	}

	tenant := &EphemeralTenant{
		ID:        fmt.Sprintf("playground_%s", sessionID),
		APIKey:    fmt.Sprintf("pk_playground_%s", sessionID),
		Endpoint:  m.config.CloudURL,
		ExpiresAt: time.Now().Add(m.config.TenantTTL),
		CreatedAt: time.Now(),
	}

	m.tenants[sessionID] = tenant
	return tenant, nil
}

// Get returns an ephemeral tenant by session ID.
func (m *Manager) Get(sessionID string) (*EphemeralTenant, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	t, ok := m.tenants[sessionID]
	if !ok || time.Now().After(t.ExpiresAt) {
		return nil, false
	}
	return t, true
}

// Revoke removes a tenant.
func (m *Manager) Revoke(sessionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.tenants, sessionID)
}

// ActiveCount returns the number of active tenants.
func (m *Manager) ActiveCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	count := 0
	now := time.Now()
	for _, t := range m.tenants {
		if now.Before(t.ExpiresAt) {
			count++
		}
	}
	return count
}

func (m *Manager) cleanup() {
	now := time.Now()
	for id, t := range m.tenants {
		if now.After(t.ExpiresAt) {
			delete(m.tenants, id)
		}
	}
}

// Handler provides HTTP endpoints for cloud mode.
type Handler struct {
	manager *Manager
}

// NewHandler creates a cloud mode HTTP handler.
func NewHandler(manager *Manager) *Handler {
	return &Handler{manager: manager}
}

// Status handles GET /api/cloud/status
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"enabled":        h.manager.IsEnabled(),
		"active_tenants": h.manager.ActiveCount(),
		"max_tenants":    h.manager.config.MaxTenants,
		"tenant_ttl":     h.manager.config.TenantTTL.String(),
	})
}

// Provision handles POST /api/cloud/provision
func (h *Handler) Provision(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SessionID string `json:"session_id"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.SessionID == "" {
		req.SessionID = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	tenant, err := h.manager.Provision(req.SessionID)
	if err != nil {
		w.WriteHeader(http.StatusTooManyRequests)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tenant)
}
