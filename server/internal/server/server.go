package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/openjobspec/ojs-playground/server/internal/api"
	"github.com/openjobspec/ojs-playground/server/internal/backends"
	"github.com/openjobspec/ojs-playground/server/internal/chaos"
	"github.com/openjobspec/ojs-playground/server/internal/discovery"
	"github.com/openjobspec/ojs-playground/server/internal/history"
	"github.com/openjobspec/ojs-playground/server/internal/proxy"
	"github.com/openjobspec/ojs-playground/server/internal/sse"

	spaembed "github.com/openjobspec/ojs-playground/server/internal/embed"
)

// Deps holds all subsystem dependencies for the server.
type Deps struct {
	Config         *Config
	Store          history.Store
	Broadcaster    *sse.Broadcaster
	BackendManager *backends.Manager
	MemoryBackend  *backends.MemoryBackend
	ChaosConfig    *chaos.Config
	WorkerRegistry *discovery.Registry
}

// NewRouter creates and configures the HTTP router with all routes.
func NewRouter(deps *Deps) http.Handler {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Recoverer)
	r.Use(api.RequestIDMiddleware)
	r.Use(api.LoggerMiddleware)
	r.Use(api.CORSMiddleware)

	// Register all API routes
	routeDeps := &api.RouteDeps{
		Store:          deps.Store,
		Broadcaster:    deps.Broadcaster,
		BackendManager: deps.BackendManager,
		MemoryBackend:  deps.MemoryBackend,
		ChaosConfig:    deps.ChaosConfig,
		WorkerRegistry: deps.WorkerRegistry,
		Port:           deps.Config.Port,
		BackendNames:   deps.Config.Backends,
	}
	api.RegisterRoutes(r, routeDeps)

	// OJS protocol routes: mount memory backend directly or proxy to external backend
	if deps.MemoryBackend != nil && deps.BackendManager.ActiveName() == "memory" {
		// Mount in-memory backend as chi sub-router at /ojs/v1
		r.Mount("/ojs/v1", deps.MemoryBackend.Router())
	} else {
		// Proxy to external backend with chaos interceptor
		active, err := deps.BackendManager.Active()
		if err == nil && active.URL() != "" {
			p, err := proxy.NewProxy(active.URL(), deps.Store, deps.Broadcaster, active.Name())
			if err == nil {
				r.Route("/ojs", func(r chi.Router) {
					r.Use(proxy.ChaosInterceptor(deps.ChaosConfig))
					r.Handle("/*", p)
				})
			}
		}
	}

	// SPA catch-all (must be last)
	r.Handle("/*", spaembed.SPAHandler())

	return r
}
