package discovery

import (
	"context"
	"log/slog"
	"net/http"
	"time"
)

const (
	healthCheckInterval    = 10 * time.Second
	maxFailCount           = 3
	removeAfterDisconnect  = 30 * time.Second
)

// HealthChecker periodically checks the health of discovered workers.
type HealthChecker struct {
	registry *Registry
	cancel   context.CancelFunc
}

// NewHealthChecker creates and starts a background health checker.
func NewHealthChecker(registry *Registry) *HealthChecker {
	ctx, cancel := context.WithCancel(context.Background())
	hc := &HealthChecker{
		registry: registry,
		cancel:   cancel,
	}
	go hc.run(ctx)
	return hc
}

// Stop stops the health checker.
func (hc *HealthChecker) Stop() {
	hc.cancel()
}

func (hc *HealthChecker) run(ctx context.Context) {
	ticker := time.NewTicker(healthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			hc.checkAll(ctx)
		}
	}
}

func (hc *HealthChecker) checkAll(ctx context.Context) {
	workers := hc.registry.List()
	now := time.Now()

	for _, w := range workers {
		// Remove workers that have been disconnected too long
		if w.Status == WorkerDisconnected && now.Sub(w.LastSeen) > removeAfterDisconnect {
			slog.Info("removing stale worker", "id", w.ID, "name", w.Name)
			hc.registry.Unregister(w.ID)
			continue
		}

		// Check health
		if !checkWorkerHealth(ctx, w.URL) {
			hc.registry.MarkDisconnected(w.ID)
			if w.FailCount+1 >= maxFailCount {
				slog.Warn("worker unhealthy", "id", w.ID, "name", w.Name, "fails", w.FailCount+1)
			}
		} else {
			// Re-register to update LastSeen and reset FailCount
			hc.registry.Register(w)
		}
	}
}

func checkWorkerHealth(ctx context.Context, baseURL string) bool {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/ojs/v1/health", nil)
	if err != nil {
		return false
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}
