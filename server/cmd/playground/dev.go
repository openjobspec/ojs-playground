package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"github.com/openjobspec/ojs-playground/server/internal/backends"
	"github.com/openjobspec/ojs-playground/server/internal/chaos"
	"github.com/openjobspec/ojs-playground/server/internal/discovery"
	"github.com/openjobspec/ojs-playground/server/internal/history"
	"github.com/openjobspec/ojs-playground/server/internal/server"
	"github.com/openjobspec/ojs-playground/server/internal/sse"
)

var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "Start the playground in development mode",
	RunE:  runDev,
}

func init() {
	cfg := server.DefaultConfig()

	devCmd.Flags().IntVarP(&cfg.Port, "port", "p", cfg.Port, "HTTP port")
	devCmd.Flags().StringSliceVar(&cfg.Backends, "backend", cfg.Backends, "Backend(s) to enable: memory, redis, postgres")
	devCmd.Flags().StringVar(&cfg.RedisURL, "redis-url", cfg.RedisURL, "Redis connection URL")
	devCmd.Flags().StringVar(&cfg.PostgresURL, "postgres-url", cfg.PostgresURL, "PostgreSQL connection URL")
	devCmd.Flags().StringVar(&cfg.ScanPorts, "scan-ports", cfg.ScanPorts, "Port range for worker discovery")
	devCmd.Flags().BoolVar(&cfg.NoScan, "no-scan", cfg.NoScan, "Disable worker port scanning")
	devCmd.Flags().BoolVar(&cfg.OpenBrowser, "open", cfg.OpenBrowser, "Open browser on start")
	devCmd.Flags().BoolVarP(&cfg.Verbose, "verbose", "v", cfg.Verbose, "Verbose logging")
	devCmd.Flags().StringVar(&cfg.DataDir, "data-dir", cfg.DataDir, "Data directory for SQLite (default: ~/.ojs-playground)")

	// Store config reference for RunE
	devCmd.PreRun = func(cmd *cobra.Command, args []string) {
		cmd.SetContext(context.WithValue(cmd.Context(), configKey{}, cfg))
	}

	rootCmd.AddCommand(devCmd)
}

type configKey struct{}

func runDev(cmd *cobra.Command, args []string) error {
	cfg := cmd.Context().Value(configKey{}).(*server.Config)

	// Configure logging
	logLevel := slog.LevelInfo
	if cfg.Verbose {
		logLevel = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: logLevel})))

	// Resolve data directory
	if cfg.DataDir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return fmt.Errorf("resolve home dir: %w", err)
		}
		cfg.DataDir = home + "/.ojs-playground"
	}
	if err := os.MkdirAll(cfg.DataDir, 0755); err != nil {
		return fmt.Errorf("create data dir: %w", err)
	}

	ctx := context.Background()

	// Initialize SQLite history store
	dbPath := filepath.Join(cfg.DataDir, "playground.db")
	store, err := history.NewSQLiteStore(ctx, dbPath)
	if err != nil {
		return fmt.Errorf("init sqlite: %w", err)
	}
	defer store.Close()
	slog.Info("history store initialized", "path", dbPath)

	// Initialize SSE broadcaster
	broadcaster := sse.NewBroadcaster()

	// Initialize chaos config
	chaosConfig := chaos.NewConfig()

	// Initialize worker registry
	workerRegistry := discovery.NewRegistry(broadcaster)

	// Initialize backend manager
	activeBackend := "memory"
	if len(cfg.Backends) > 0 {
		activeBackend = cfg.Backends[0]
	}
	backendManager := backends.NewManager(activeBackend)

	// Create memory backend with state change callback
	var memoryBackend *backends.MemoryBackend
	memoryBackend = backends.NewMemoryBackend(func(job *backends.MemoryJob, fromState, toState string) {
		// Record in history
		now := time.Now()
		histJob := &history.Job{
			ID:          job.ID,
			Type:        job.Type,
			State:       toState,
			Queue:       job.Queue,
			Args:        job.Args,
			Meta:        job.Meta,
			Priority:    job.Priority,
			Attempt:     job.Attempt,
			MaxAttempts: job.MaxAttempts,
			CreatedAt:   now,
			UpdatedAt:   now,
			Backend:     "memory",
			Result:      job.Result,
			Error:       job.Error,
		}
		if err := store.SaveJob(ctx, histJob); err != nil {
			slog.Warn("failed to save job to history", "err", err)
		}
		if fromState != "" {
			if err := store.UpdateJobState(ctx, job.ID, fromState, toState, ""); err != nil {
				slog.Warn("failed to update job state in history", "err", err)
			}
		}

		// Broadcast SSE event
		eventType := sse.EventJobStateChanged
		switch toState {
		case "completed":
			eventType = sse.EventJobCompleted
		case "discarded":
			eventType = sse.EventJobDead
		}
		broadcaster.Broadcast(sse.Event{
			Type:      eventType,
			Timestamp: now,
			JobID:     job.ID,
			Queue:     job.Queue,
			Data: map[string]any{
				"job_id":     job.ID,
				"type":       job.Type,
				"from_state": fromState,
				"to_state":   toState,
				"queue":      job.Queue,
			},
		})
	})
	backendManager.Register(memoryBackend)

	// Start worker discovery (unless disabled)
	if !cfg.NoScan {
		scanner := discovery.NewScanner(cfg.ScanPorts)
		go func() {
			slog.Info("scanning for workers", "ports", cfg.ScanPorts)
			endpoints := scanner.Scan(ctx)
			for _, ep := range endpoints {
				workerRegistry.Register(&discovery.DiscoveredWorker{
					ID:       fmt.Sprintf("scan-%d", ep.Port),
					Name:     ep.Manifest.Name,
					URL:      ep.URL,
					Port:     ep.Port,
					Queues:   ep.Manifest.Queues,
					JobTypes: ep.Manifest.JobTypes,
				})
			}
			slog.Info("worker scan complete", "found", len(endpoints))
		}()

		// Start health checker
		healthChecker := discovery.NewHealthChecker(workerRegistry)
		defer healthChecker.Stop()
	}

	// Build router with all dependencies
	deps := &server.Deps{
		Config:         cfg,
		Store:          store,
		Broadcaster:    broadcaster,
		BackendManager: backendManager,
		MemoryBackend:  memoryBackend,
		ChaosConfig:    chaosConfig,
		WorkerRegistry: workerRegistry,
	}
	router := server.NewRouter(deps)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 0, // SSE requires no write timeout
		IdleTimeout:  120 * time.Second,
	}

	// Start server
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	// Print banner
	printBanner(cfg)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "err", err)
	}

	backendManager.Close()
	slog.Info("server stopped")
	return nil
}

func printBanner(cfg *server.Config) {
	fmt.Println()
	fmt.Println("  OJS Playground v" + version)
	fmt.Println("  ────────────────────────────────")
	fmt.Printf("  UI:       http://localhost:%d\n", cfg.Port)
	fmt.Printf("  API:      http://localhost:%d/api\n", cfg.Port)
	fmt.Printf("  OJS:      http://localhost:%d/ojs/v1\n", cfg.Port)
	fmt.Printf("  Backends: %s\n", strings.Join(cfg.Backends, ", "))
	if !cfg.NoScan {
		fmt.Printf("  Scanning: ports %s\n", cfg.ScanPorts)
	}
	fmt.Printf("  Data:     %s\n", cfg.DataDir)
	fmt.Println()
	fmt.Println("  Press Ctrl+C to stop")
	fmt.Println()
}
