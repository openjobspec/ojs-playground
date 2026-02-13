package history

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// SQLiteStore implements Store using SQLite.
type SQLiteStore struct {
	db *sql.DB
}

// NewSQLiteStore opens a SQLite database at the given path and runs migrations.
func NewSQLiteStore(ctx context.Context, dbPath string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	// Connection pool settings for WAL mode
	db.SetMaxOpenConns(1)  // Single writer
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(0)

	if err := RunMigrations(ctx, db); err != nil {
		db.Close()
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) SaveJob(ctx context.Context, job *Job) error {
	args := "[]"
	if job.Args != nil {
		args = string(job.Args)
	}
	meta := "{}"
	if job.Meta != nil {
		meta = string(job.Meta)
	}

	var result, errStr *string
	if job.Result != nil {
		s := string(job.Result)
		result = &s
	}
	if job.Error != nil {
		s := string(job.Error)
		errStr = &s
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO playground_jobs (id, type, state, queue, args, meta, priority, attempt, max_attempts, created_at, updated_at, backend, result, error)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			state = excluded.state,
			attempt = excluded.attempt,
			updated_at = excluded.updated_at,
			result = excluded.result,
			error = excluded.error
	`,
		job.ID, job.Type, job.State, job.Queue, args, meta,
		job.Priority, job.Attempt, job.MaxAttempts,
		job.CreatedAt.UTC().Format(time.RFC3339),
		job.UpdatedAt.UTC().Format(time.RFC3339),
		job.Backend, result, errStr,
	)
	return err
}

func (s *SQLiteStore) UpdateJobState(ctx context.Context, jobID, fromState, toState, reason string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx,
		"UPDATE playground_jobs SET state = ?, updated_at = datetime('now') WHERE id = ?",
		toState, jobID,
	)
	if err != nil {
		tx.Rollback()
		return err
	}

	_, err = tx.ExecContext(ctx,
		"INSERT INTO job_state_history (job_id, from_state, to_state, reason) VALUES (?, ?, ?, ?)",
		jobID, fromState, toState, reason,
	)
	if err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}

func (s *SQLiteStore) GetJob(ctx context.Context, jobID string) (*Job, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, type, state, queue, args, meta, priority, attempt, max_attempts, created_at, updated_at, backend, result, error
		FROM playground_jobs WHERE id = ?
	`, jobID)

	return scanJob(row)
}

func (s *SQLiteStore) ListJobs(ctx context.Context, filter ListFilter) ([]*Job, int, error) {
	where := "1=1"
	args := []any{}

	if filter.State != "" {
		where += " AND state = ?"
		args = append(args, filter.State)
	}
	if filter.Type != "" {
		where += " AND type = ?"
		args = append(args, filter.Type)
	}
	if filter.Queue != "" {
		where += " AND queue = ?"
		args = append(args, filter.Queue)
	}

	// Count total
	var total int
	countArgs := make([]any, len(args))
	copy(countArgs, args)
	err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM playground_jobs WHERE "+where, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Apply pagination
	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	query := fmt.Sprintf("SELECT id, type, state, queue, args, meta, priority, attempt, max_attempts, created_at, updated_at, backend, result, error FROM playground_jobs WHERE %s ORDER BY created_at DESC LIMIT ? OFFSET ?", where)
	args = append(args, limit, filter.Offset)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var jobs []*Job
	for rows.Next() {
		job, err := scanJobRows(rows)
		if err != nil {
			return nil, 0, err
		}
		jobs = append(jobs, job)
	}

	return jobs, total, rows.Err()
}

func (s *SQLiteStore) GetJobHistory(ctx context.Context, jobID string) ([]StateChange, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT from_state, to_state, timestamp, reason FROM job_state_history WHERE job_id = ? ORDER BY timestamp ASC",
		jobID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var changes []StateChange
	for rows.Next() {
		var sc StateChange
		var ts string
		if err := rows.Scan(&sc.FromState, &sc.ToState, &ts, &sc.Reason); err != nil {
			return nil, err
		}
		sc.Timestamp, _ = time.Parse(time.RFC3339, ts)
		changes = append(changes, sc)
	}

	return changes, rows.Err()
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

// scanner interface to share between QueryRow and Rows.Scan
type scanner interface {
	Scan(dest ...any) error
}

func scanJob(row *sql.Row) (*Job, error) {
	var job Job
	var args, meta, createdAt, updatedAt string
	var result, errStr *string

	err := row.Scan(&job.ID, &job.Type, &job.State, &job.Queue, &args, &meta,
		&job.Priority, &job.Attempt, &job.MaxAttempts,
		&createdAt, &updatedAt, &job.Backend, &result, &errStr)
	if err != nil {
		return nil, err
	}

	job.Args = json.RawMessage(args)
	job.Meta = json.RawMessage(meta)
	job.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	job.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	if result != nil {
		job.Result = json.RawMessage(*result)
	}
	if errStr != nil {
		job.Error = json.RawMessage(*errStr)
	}

	return &job, nil
}

func scanJobRows(rows *sql.Rows) (*Job, error) {
	var job Job
	var args, meta, createdAt, updatedAt string
	var result, errStr *string

	err := rows.Scan(&job.ID, &job.Type, &job.State, &job.Queue, &args, &meta,
		&job.Priority, &job.Attempt, &job.MaxAttempts,
		&createdAt, &updatedAt, &job.Backend, &result, &errStr)
	if err != nil {
		return nil, err
	}

	job.Args = json.RawMessage(args)
	job.Meta = json.RawMessage(meta)
	job.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	job.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	if result != nil {
		job.Result = json.RawMessage(*result)
	}
	if errStr != nil {
		job.Error = json.RawMessage(*errStr)
	}

	return &job, nil
}
