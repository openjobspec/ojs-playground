// Package demo provides an embeddable interactive OJS terminal for the landing page.
//
// It runs a lightweight proxy to an OJS Lite backend, pre-populating it with
// example jobs and providing guided step-by-step commands.
package demo

import (
	"encoding/json"
	"net/http"
)

// Steps defines the guided tutorial flow.
var Steps = []Step{
	{
		Num:     1,
		Title:   "Check server health",
		Command: `curl -s http://localhost:8080/ojs/v1/health | jq .`,
		Expect:  `{"status":"healthy"}`,
	},
	{
		Num:     2,
		Title:   "Enqueue your first job",
		Command: `curl -s -X POST http://localhost:8080/ojs/v1/jobs -H "Content-Type: application/json" -d '{"type":"email.send","args":["user@example.com","Welcome!","Thanks for signing up."],"queue":"default"}' | jq .`,
		Expect:  `"state": "available"`,
	},
	{
		Num:     3,
		Title:   "Fetch the job as a worker",
		Command: `curl -s -X POST http://localhost:8080/ojs/v1/workers/fetch -H "Content-Type: application/json" -d '{"queues":["default"],"worker_id":"demo-worker"}' | jq .`,
		Expect:  `"state": "active"`,
	},
	{
		Num:     4,
		Title:   "Complete the job",
		Command: `curl -s -X POST http://localhost:8080/ojs/v1/workers/ack -H "Content-Type: application/json" -d '{"job_id":"JOB_ID"}' | jq .`,
		Expect:  `"state": "completed"`,
	},
	{
		Num:     5,
		Title:   "Check queue stats",
		Command: `curl -s http://localhost:8080/ojs/v1/queues | jq .`,
		Expect:  `"name": "default"`,
	},
}

// Step is a single tutorial step.
type Step struct {
	Num     int    `json:"num"`
	Title   string `json:"title"`
	Command string `json:"command"`
	Expect  string `json:"expect"`
}

// Handler serves the tutorial steps as JSON.
type Handler struct{}

// NewHandler creates a demo handler.
func NewHandler() *Handler { return &Handler{} }

// ServeSteps handles GET /api/demo/steps
func (h *Handler) ServeSteps(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"title": "Try OJS in 60 Seconds",
		"steps": Steps,
		"total": len(Steps),
	})
}
