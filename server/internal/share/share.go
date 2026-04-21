package share

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/openjobspec/ojs-playground/server/internal/httpjson"
)

// --- Shareable Playground Links ---

// PlaygroundState represents the full state of a playground session.
type PlaygroundState struct {
	Version     string          `json:"version"`
	Schema      json.RawMessage `json:"schema,omitempty"`
	Code        string          `json:"code,omitempty"`
	Language    string          `json:"language,omitempty"`
	Backend     string          `json:"backend,omitempty"`
	BackendURL  string          `json:"backend_url,omitempty"`
	Tab         string          `json:"tab,omitempty"`
	Jobs        json.RawMessage `json:"jobs,omitempty"`
	Title       string          `json:"title,omitempty"`
	Description string          `json:"description,omitempty"`
}

// ShareableLink holds a persisted playground state.
type ShareableLink struct {
	ID        string          `json:"id"`
	State     PlaygroundState `json:"state"`
	CreatedAt time.Time       `json:"created_at"`
	ExpiresAt time.Time       `json:"expires_at"`
	ViewCount int64           `json:"view_count"`
	CreatedBy string          `json:"created_by,omitempty"`
}

// LinkStore persists shareable playground links.
type LinkStore struct {
	mu    sync.RWMutex
	links map[string]*ShareableLink
	ttl   time.Duration
}

// NewLinkStore creates a link store.
func NewLinkStore(ttl time.Duration) *LinkStore {
	if ttl <= 0 {
		ttl = 30 * 24 * time.Hour // 30 days default
	}
	return &LinkStore{
		links: make(map[string]*ShareableLink),
		ttl:   ttl,
	}
}

// Create persists a playground state and returns a shareable link ID.
func (ls *LinkStore) Create(state PlaygroundState) (*ShareableLink, error) {
	data, err := json.Marshal(state)
	if err != nil {
		return nil, fmt.Errorf("marshaling state: %w", err)
	}

	// Generate a short, deterministic ID from content hash
	hash := sha256.Sum256(data)
	id := base64.RawURLEncoding.EncodeToString(hash[:8])

	ls.mu.Lock()
	defer ls.mu.Unlock()

	now := time.Now()
	link := &ShareableLink{
		ID:        id,
		State:     state,
		CreatedAt: now,
		ExpiresAt: now.Add(ls.ttl),
	}
	ls.links[id] = link
	return link, nil
}

// Get retrieves a shareable link by ID.
func (ls *LinkStore) Get(id string) (*ShareableLink, bool) {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	link, ok := ls.links[id]
	if !ok {
		return nil, false
	}
	if time.Now().After(link.ExpiresAt) {
		delete(ls.links, id)
		return nil, false
	}
	link.ViewCount++
	lc := *link
	return &lc, true
}

// Count returns the number of stored links.
func (ls *LinkStore) Count() int {
	ls.mu.RLock()
	defer ls.mu.RUnlock()
	return len(ls.links)
}

// Prune removes expired links.
func (ls *LinkStore) Prune() int {
	ls.mu.Lock()
	defer ls.mu.Unlock()
	now := time.Now()
	removed := 0
	for id, link := range ls.links {
		if now.After(link.ExpiresAt) {
			delete(ls.links, id)
			removed++
		}
	}
	return removed
}

// --- URL-Encoded State (for short links without persistence) ---

// EncodeStateToURL compresses and base64-encodes playground state for URL embedding.
func EncodeStateToURL(state PlaygroundState) (string, error) {
	data, err := json.Marshal(state)
	if err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(data), nil
}

// DecodeStateFromURL decodes a URL-encoded playground state.
func DecodeStateFromURL(encoded string) (*PlaygroundState, error) {
	if len(encoded) > 2<<20 {
		return nil, fmt.Errorf("encoded state is too large")
	}
	data, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decoding base64: %w", err)
	}
	if len(data) > 1<<20 {
		return nil, fmt.Errorf("decoded state is too large")
	}

	var state PlaygroundState
	decoder := json.NewDecoder(strings.NewReader(string(data)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&state); err != nil {
		return nil, fmt.Errorf("unmarshaling state: %w", err)
	}
	return &state, nil
}

// --- HTTP Handlers ---

// HandleShareCreate creates a shareable link.
func HandleShareCreate(store *LinkStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var state PlaygroundState
		if decodeErr := httpjson.Decode(w, r, &state, httpjson.MaxAPIRequestBytes, false); decodeErr != nil {
			http.Error(w, decodeErr.Message, decodeErr.Status)
			return
		}

		if len(state.Version) > 16 || len(state.Language) > 32 || len(state.Backend) > 64 ||
			len(state.BackendURL) > 2048 || len(state.Tab) > 64 || len(state.Title) > 256 ||
			len(state.Description) > 4096 || len(state.Code) > 512<<10 {
			http.Error(w, "share field is too large", http.StatusRequestEntityTooLarge)
			return
		}
		if _, decodeErr := httpjson.RequireJSONObject("schema", state.Schema, httpjson.MaxMetaBytes, 1000, true); decodeErr != nil {
			http.Error(w, decodeErr.Message, decodeErr.Status)
			return
		}
		if len(state.Jobs) > 0 {
			if _, decodeErr := httpjson.RequireJSONArray("jobs", state.Jobs, httpjson.MaxArgsBytes, 1000); decodeErr != nil {
				http.Error(w, decodeErr.Message, decodeErr.Status)
				return
			}
		}

		link, err := store.Create(state)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":         link.ID,
			"url":        fmt.Sprintf("/playground/share/%s", link.ID),
			"expires_at": link.ExpiresAt,
		})
	}
}

// HandleShareGet retrieves a shared playground state.
func HandleShareGet(store *LinkStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "missing id parameter", http.StatusBadRequest)
			return
		}

		link, ok := store.Get(id)
		if !ok {
			http.Error(w, "link not found or expired", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(link)
	}
}

// --- Live Backend Connectivity ---

// BackendConnection represents a live connection to an OJS backend.
type BackendConnection struct {
	URL       string    `json:"url"`
	Status    string    `json:"status"`            // connected, disconnected, error
	Backend   string    `json:"backend,omitempty"` // redis, postgres, nats, etc.
	Version   string    `json:"version,omitempty"`
	Latency   int64     `json:"latency_ms"`
	LastCheck time.Time `json:"last_check"`
}

// CheckBackendHealth verifies a backend is reachable.
func CheckBackendHealth(backendURL string) *BackendConnection {
	conn := &BackendConnection{
		URL:       backendURL,
		LastCheck: time.Now(),
	}

	client := &http.Client{Timeout: 5 * time.Second}
	start := time.Now()
	resp, err := client.Get(backendURL + "/ojs/v1/health")
	conn.Latency = time.Since(start).Milliseconds()

	if err != nil {
		conn.Status = "error"
		return conn
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		conn.Status = "error"
		return conn
	}

	conn.Status = "connected"

	var health map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&health); err == nil {
		if v, ok := health["version"].(string); ok {
			conn.Version = v
		}
		if b, ok := health["backend"].(string); ok {
			conn.Backend = b
		}
	}
	return conn
}
