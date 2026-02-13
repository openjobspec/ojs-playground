package discovery

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Scanner probes a port range for OJS workers.
type Scanner struct {
	portRange   string
	concurrency int
}

// NewScanner creates a scanner for the given port range (e.g. "3000-9999").
func NewScanner(portRange string) *Scanner {
	return &Scanner{
		portRange:   portRange,
		concurrency: 50,
	}
}

// DiscoveredEndpoint is a found OJS worker endpoint.
type DiscoveredEndpoint struct {
	Port     int
	URL      string
	Manifest *Manifest
}

// Scan probes the port range and returns discovered OJS endpoints.
func (s *Scanner) Scan(ctx context.Context) []DiscoveredEndpoint {
	startPort, endPort := parsePortRange(s.portRange)
	if startPort == 0 {
		return nil
	}

	sem := make(chan struct{}, s.concurrency)
	var mu sync.Mutex
	var results []DiscoveredEndpoint

	var wg sync.WaitGroup
	for port := startPort; port <= endPort; port++ {
		select {
		case <-ctx.Done():
			break
		default:
		}

		wg.Add(1)
		sem <- struct{}{}
		go func(p int) {
			defer wg.Done()
			defer func() { <-sem }()

			ep := probePort(ctx, p)
			if ep != nil {
				mu.Lock()
				results = append(results, *ep)
				mu.Unlock()
				slog.Debug("discovered worker", "port", p, "name", ep.Manifest.Name)
			}
		}(port)
	}
	wg.Wait()

	return results
}

func probePort(ctx context.Context, port int) *DiscoveredEndpoint {
	addr := fmt.Sprintf("localhost:%d", port)

	// Quick TCP check first
	conn, err := net.DialTimeout("tcp", addr, 500*time.Millisecond)
	if err != nil {
		return nil
	}
	conn.Close()

	// Try to fetch manifest
	url := fmt.Sprintf("http://%s", addr)
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url+"/ojs/v1/health", nil)
	if err != nil {
		return nil
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	// Try manifest
	manifest, _ := FetchManifest(ctx, url)
	if manifest == nil {
		manifest = &Manifest{Name: fmt.Sprintf("worker:%d", port)}
	}

	return &DiscoveredEndpoint{
		Port:     port,
		URL:      url,
		Manifest: manifest,
	}
}

func parsePortRange(s string) (int, int) {
	parts := strings.SplitN(s, "-", 2)
	if len(parts) != 2 {
		p, err := strconv.Atoi(s)
		if err != nil {
			return 0, 0
		}
		return p, p
	}
	start, err1 := strconv.Atoi(parts[0])
	end, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return 0, 0
	}
	return start, end
}
