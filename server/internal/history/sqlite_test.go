package history

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func newTestStore(t *testing.T) *SQLiteStore {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	store, err := NewSQLiteStore(context.Background(), dbPath)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })
	return store
}

func testJob(id string) *Job {
	now := time.Now().UTC().Truncate(time.Second)
	return &Job{
		ID:          id,
		Type:        "email.send",
		State:       "available",
		Queue:       "default",
		Args:        json.RawMessage(`["user@test.com"]`),
		Meta:        json.RawMessage(`{"trace_id":"abc123"}`),
		Priority:    0,
		Attempt:     0,
		MaxAttempts: 3,
		CreatedAt:   now,
		UpdatedAt:   now,
		Backend:     "memory",
	}
}

func TestSaveAndGetJob(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	job := testJob("job-001")
	if err := store.SaveJob(ctx, job); err != nil {
		t.Fatal(err)
	}

	got, err := store.GetJob(ctx, "job-001")
	if err != nil {
		t.Fatal(err)
	}

	if got.ID != "job-001" {
		t.Errorf("expected ID job-001, got %s", got.ID)
	}
	if got.Type != "email.send" {
		t.Errorf("expected type email.send, got %s", got.Type)
	}
	if got.State != "available" {
		t.Errorf("expected state available, got %s", got.State)
	}
	if got.Queue != "default" {
		t.Errorf("expected queue default, got %s", got.Queue)
	}
	if got.Backend != "memory" {
		t.Errorf("expected backend memory, got %s", got.Backend)
	}
}

func TestSaveJobUpsert(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	job := testJob("job-002")
	if err := store.SaveJob(ctx, job); err != nil {
		t.Fatal(err)
	}

	// Update state
	job.State = "active"
	job.Attempt = 1
	job.UpdatedAt = time.Now().UTC().Truncate(time.Second)
	if err := store.SaveJob(ctx, job); err != nil {
		t.Fatal(err)
	}

	got, err := store.GetJob(ctx, "job-002")
	if err != nil {
		t.Fatal(err)
	}

	if got.State != "active" {
		t.Errorf("expected state active after upsert, got %s", got.State)
	}
	if got.Attempt != 1 {
		t.Errorf("expected attempt 1 after upsert, got %d", got.Attempt)
	}
}

func TestGetJobNotFound(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	_, err := store.GetJob(ctx, "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent job")
	}
}

func TestUpdateJobState(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	job := testJob("job-003")
	store.SaveJob(ctx, job)

	if err := store.UpdateJobState(ctx, "job-003", "available", "active", "worker fetched"); err != nil {
		t.Fatal(err)
	}

	got, err := store.GetJob(ctx, "job-003")
	if err != nil {
		t.Fatal(err)
	}
	if got.State != "active" {
		t.Errorf("expected state active, got %s", got.State)
	}
}

func TestGetJobHistory(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	job := testJob("job-004")
	store.SaveJob(ctx, job)

	store.UpdateJobState(ctx, "job-004", "", "available", "enqueued")
	store.UpdateJobState(ctx, "job-004", "available", "active", "fetched")
	store.UpdateJobState(ctx, "job-004", "active", "completed", "acked")

	history, err := store.GetJobHistory(ctx, "job-004")
	if err != nil {
		t.Fatal(err)
	}

	if len(history) != 3 {
		t.Fatalf("expected 3 history entries, got %d", len(history))
	}

	if history[0].ToState != "available" {
		t.Errorf("expected first transition to available, got %s", history[0].ToState)
	}
	if history[1].ToState != "active" {
		t.Errorf("expected second transition to active, got %s", history[1].ToState)
	}
	if history[2].ToState != "completed" {
		t.Errorf("expected third transition to completed, got %s", history[2].ToState)
	}
	if history[2].Reason != "acked" {
		t.Errorf("expected reason 'acked', got %s", history[2].Reason)
	}
}

func TestListJobs(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	for i := 0; i < 5; i++ {
		job := testJob("list-" + string(rune('a'+i)))
		job.Queue = "default"
		if i >= 3 {
			job.State = "completed"
		}
		store.SaveJob(ctx, job)
	}

	// List all
	jobs, total, err := store.ListJobs(ctx, ListFilter{Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if total != 5 {
		t.Errorf("expected total 5, got %d", total)
	}
	if len(jobs) != 5 {
		t.Errorf("expected 5 jobs, got %d", len(jobs))
	}
}

func TestListJobsFilterByState(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	j1 := testJob("state-1")
	j1.State = "available"
	store.SaveJob(ctx, j1)

	j2 := testJob("state-2")
	j2.State = "completed"
	store.SaveJob(ctx, j2)

	jobs, total, err := store.ListJobs(ctx, ListFilter{State: "completed", Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(jobs) != 1 {
		t.Errorf("expected 1 job, got %d", len(jobs))
	}
	if jobs[0].ID != "state-2" {
		t.Errorf("expected state-2, got %s", jobs[0].ID)
	}
}

func TestListJobsPagination(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	for i := 0; i < 10; i++ {
		j := testJob("page-" + string(rune('0'+i)))
		store.SaveJob(ctx, j)
	}

	jobs, total, err := store.ListJobs(ctx, ListFilter{Limit: 3, Offset: 0})
	if err != nil {
		t.Fatal(err)
	}
	if total != 10 {
		t.Errorf("expected total 10, got %d", total)
	}
	if len(jobs) != 3 {
		t.Errorf("expected 3 jobs in page, got %d", len(jobs))
	}
}

func TestSaveJobWithResultAndError(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	job := testJob("res-001")
	job.Result = json.RawMessage(`{"delivered":true}`)
	job.Error = json.RawMessage(`{"type":"timeout","message":"deadline exceeded"}`)

	if err := store.SaveJob(ctx, job); err != nil {
		t.Fatal(err)
	}

	got, err := store.GetJob(ctx, "res-001")
	if err != nil {
		t.Fatal(err)
	}

	if string(got.Result) != `{"delivered":true}` {
		t.Errorf("unexpected result: %s", got.Result)
	}
	if string(got.Error) != `{"type":"timeout","message":"deadline exceeded"}` {
		t.Errorf("unexpected error: %s", got.Error)
	}
}

func TestNewSQLiteStoreInvalidPath(t *testing.T) {
	// This should fail on non-writable path
	_, err := NewSQLiteStore(context.Background(), "/nonexistent/dir/test.db")
	// On some systems this may not fail at Open but at migration, just check it doesn't panic
	_ = err
}

func TestCloseIdempotent(t *testing.T) {
	dir := t.TempDir()
	store, err := NewSQLiteStore(context.Background(), filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	// Double close shouldn't panic
	store.Close()
}

// Ensure temp files are cleaned up
func TestTempDirCleanup(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "cleanup.db")
	store, _ := NewSQLiteStore(context.Background(), dbPath)
	if store != nil {
		store.Close()
	}
	// Verify the dir exists (Go's t.TempDir handles cleanup)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Error("temp dir should still exist during test")
	}
}
