package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Manifest represents an OJS worker's manifest response.
type Manifest struct {
	Name     string   `json:"name"`
	Version  string   `json:"version,omitempty"`
	Queues   []string `json:"queues,omitempty"`
	JobTypes []string `json:"job_types,omitempty"`
}

// FetchManifest retrieves a worker's manifest from the given URL.
func FetchManifest(ctx context.Context, baseURL string) (*Manifest, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/ojs/manifest", nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("manifest returned %d", resp.StatusCode)
	}

	var m Manifest
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
		return nil, fmt.Errorf("decode manifest: %w", err)
	}

	return &m, nil
}
