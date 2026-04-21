package api

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/go-chi/chi/v5"

	"github.com/openjobspec/ojs-playground/server/internal/backends"
	"github.com/openjobspec/ojs-playground/server/internal/chaos"
	"github.com/openjobspec/ojs-playground/server/internal/conformance"
	"github.com/openjobspec/ojs-playground/server/internal/discovery"
	"github.com/openjobspec/ojs-playground/server/internal/history"
	"github.com/openjobspec/ojs-playground/server/internal/sse"
)

// RouteDeps holds all dependencies needed for route registration.
type RouteDeps struct {
	Context        context.Context
	Store          history.Store
	Broadcaster    *sse.Broadcaster
	BackendManager *backends.Manager
	MemoryBackend  *backends.MemoryBackend
	ChaosConfig    *chaos.Config
	WorkerRegistry *discovery.Registry
	Port           int
	BackendNames   []string
	SuitesDir      string
	OJSBaseURL     string
}

// RegisterRoutes registers all API routes on the given chi router.
func RegisterRoutes(r chi.Router, deps *RouteDeps) {
	healthHandler := NewHealthHandler(deps.Port, deps.BackendNames)
	jobHandler := NewJobHandler(deps.Store, deps.MemoryBackend, deps.Broadcaster, deps.BackendManager.ActiveName())
	backendHandler := NewBackendHandler(deps.BackendManager)
	workerHandler := NewWorkerHandler(deps.WorkerRegistry)
	chaosHandler := NewChaosHandler(deps.ChaosConfig, deps.Broadcaster)

	// Create conformance runner if suites directory is configured
	var runner *conformance.Runner
	if deps.SuitesDir != "" {
		suites, err := conformance.NewSuiteLoader(deps.SuitesDir)
		if err != nil {
			slog.Warn("failed to load conformance suites", "dir", deps.SuitesDir, "err", err)
		} else if suites.Count() > 0 {
			baseURL := deps.OJSBaseURL
			if baseURL == "" {
				baseURL = fmt.Sprintf("http://localhost:%d", deps.Port)
			}
			runner = conformance.NewRunner(baseURL, suites, deps.Broadcaster)
			if deps.MemoryBackend != nil && deps.BackendManager.ActiveName() == "memory" {
				runner.SetTestReset(deps.MemoryBackend.Reset)
			}
			slog.Info("conformance runner initialized", "suites", suites.Count(), "dir", deps.SuitesDir)
		}
	}

	conformanceHandler := NewConformanceHandler(deps.Context, runner, ConformanceHandlerOptions{})
	sseHandler := sse.NewHandler(deps.Broadcaster)

	r.Route("/api", func(r chi.Router) {
		// Health
		r.Get("/health", healthHandler.Health)

		// Jobs
		r.Post("/jobs", jobHandler.Create)
		r.Get("/jobs", jobHandler.List)
		r.Get("/jobs/{id}", jobHandler.Get)
		r.Get("/jobs/{id}/history", jobHandler.GetHistory)
		r.Delete("/jobs/{id}", jobHandler.Cancel)
		r.Post("/jobs/{id}/retry", jobHandler.Retry)

		// Backends
		r.Get("/backends", backendHandler.List)
		r.Get("/backends/{name}/stats", backendHandler.Stats)
		r.Post("/backends/{name}/pause", backendHandler.Pause)
		r.Post("/backends/{name}/resume", backendHandler.Resume)

		// Workers
		r.Get("/workers", workerHandler.List)
		r.Post("/workers", workerHandler.Register)
		r.Delete("/workers/{id}", workerHandler.Delete)
		r.Post("/workers/{id}/drain", workerHandler.Drain)

		// Chaos
		r.Get("/chaos", chaosHandler.Get)
		r.Put("/chaos", chaosHandler.Update)
		r.Delete("/chaos", chaosHandler.Reset)

		// Conformance
		r.Post("/conformance/run", conformanceHandler.Run)
		r.Get("/conformance/run/{id}", conformanceHandler.GetRun)
		r.Delete("/conformance/run/{id}", conformanceHandler.CancelRun)
		r.Get("/conformance/run/{id}/report", conformanceHandler.GetReport)

		// SSE events
		r.Get("/events", sseHandler.ServeHTTP)
	})
}
