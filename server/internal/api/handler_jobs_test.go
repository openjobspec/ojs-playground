package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/openjobspec/ojs-playground/server/internal/history"
	"github.com/openjobspec/ojs-playground/server/internal/httpjson"
)

type jobTestStore struct {
	filter  history.ListFilter
	job     *history.Job
	history []history.StateChange
}

func (s *jobTestStore) SaveJob(context.Context, *history.Job) error { return nil }
func (s *jobTestStore) UpdateJobState(context.Context, string, string, string, string) error {
	return nil
}
func (s *jobTestStore) GetJob(context.Context, string) (*history.Job, error) {
	if s.job != nil {
		return s.job, nil
	}
	return &history.Job{ID: "job-1"}, nil
}
func (s *jobTestStore) ListJobs(_ context.Context, filter history.ListFilter) ([]*history.Job, int, error) {
	s.filter = filter
	return []*history.Job{}, 0, nil
}
func (s *jobTestStore) GetJobHistory(context.Context, string) ([]history.StateChange, error) {
	return append([]history.StateChange(nil), s.history...), nil
}
func (s *jobTestStore) Close() error { return nil }

func TestJobCreateRejectsUnknownAndOversizedBodies(t *testing.T) {
	handler := NewJobHandler(&jobTestStore{}, nil, nil, "memory")

	unknownReq := httptest.NewRequest(http.MethodPost, "/api/jobs", strings.NewReader(`{"type":"test.job","args":[],"extra":true}`))
	unknownRecorder := httptest.NewRecorder()
	handler.Create(unknownRecorder, unknownReq)
	if unknownRecorder.Code != http.StatusBadRequest {
		t.Fatalf("expected unknown field to return 400, got %d", unknownRecorder.Code)
	}

	chunkedBody := `{"type":"test.job","args":["` + strings.Repeat("x", 1<<20) + `"]}`
	chunkedReq := httptest.NewRequest(http.MethodPost, "/api/jobs", io.NopCloser(strings.NewReader(chunkedBody)))
	chunkedReq.ContentLength = -1
	chunkedReq.TransferEncoding = []string{"chunked"}
	chunkedRecorder := httptest.NewRecorder()
	handler.Create(chunkedRecorder, chunkedReq)
	if chunkedRecorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected chunked body to return 413, got %d", chunkedRecorder.Code)
	}

	argsBody, err := json.Marshal(map[string]any{
		"type": "test.job",
		"args": []string{strings.Repeat("x", httpjson.MaxArgsBytes)},
	})
	if err != nil {
		t.Fatal(err)
	}
	argsReq := httptest.NewRequest(http.MethodPost, "/api/jobs", strings.NewReader(string(argsBody)))
	argsRecorder := httptest.NewRecorder()
	handler.Create(argsRecorder, argsReq)
	if argsRecorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected oversized args to return 413, got %d", argsRecorder.Code)
	}
}

func TestJobListClampsPagination(t *testing.T) {
	store := &jobTestStore{}
	handler := NewJobHandler(store, nil, nil, "memory")

	req := httptest.NewRequest(http.MethodGet, "/api/jobs?limit=999999&offset=-20", nil)
	recorder := httptest.NewRecorder()
	handler.List(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if store.filter.Limit != httpjson.MaxListLimit || store.filter.Offset != 0 {
		t.Fatalf("pagination was not clamped: %+v", store.filter)
	}

	badReq := httptest.NewRequest(http.MethodGet, "/api/jobs?limit=not-a-number", nil)
	badRecorder := httptest.NewRecorder()
	handler.List(badRecorder, badReq)
	if badRecorder.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid limit to return 400, got %d", badRecorder.Code)
	}
}

func TestJobHistoryRouteClampsPagination(t *testing.T) {
	store := &jobTestStore{job: &history.Job{ID: "job-1"}}
	for i := 0; i < 600; i++ {
		store.history = append(store.history, history.StateChange{
			FromState: "available",
			ToState:   "active",
			Timestamp: time.Unix(int64(i), 0),
		})
	}
	handler := NewJobHandler(store, nil, nil, "memory")
	router := chi.NewRouter()
	router.Get("/api/jobs/{id}/history", handler.GetHistory)

	req := httptest.NewRequest(http.MethodGet, "/api/jobs/job-1/history?limit=999999&offset=-1", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		History []history.StateChange `json:"history"`
		Limit   int                   `json:"limit"`
		Offset  int                   `json:"offset"`
		Total   int                   `json:"total"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Limit != httpjson.MaxHistoryLimit || response.Offset != 0 ||
		len(response.History) != httpjson.MaxHistoryLimit || response.Total != 600 {
		t.Fatalf("unexpected history pagination: %+v", response)
	}
}
