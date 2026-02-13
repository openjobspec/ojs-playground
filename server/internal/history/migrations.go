package history

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
)

var migrations = []struct {
	name string
	sql  string
}{
	{
		name: "001_create_playground_jobs",
		sql: `
			CREATE TABLE IF NOT EXISTS playground_jobs (
				id          TEXT PRIMARY KEY,
				type        TEXT NOT NULL,
				state       TEXT NOT NULL DEFAULT 'available',
				queue       TEXT NOT NULL DEFAULT 'default',
				args        TEXT NOT NULL DEFAULT '[]',
				meta        TEXT DEFAULT '{}',
				priority    INTEGER NOT NULL DEFAULT 0,
				attempt     INTEGER NOT NULL DEFAULT 0,
				max_attempts INTEGER NOT NULL DEFAULT 3,
				created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
				updated_at  DATETIME NOT NULL DEFAULT (datetime('now')),
				backend     TEXT NOT NULL DEFAULT 'memory',
				result      TEXT,
				error       TEXT
			);

			CREATE INDEX IF NOT EXISTS idx_playground_jobs_state ON playground_jobs(state);
			CREATE INDEX IF NOT EXISTS idx_playground_jobs_type ON playground_jobs(type);
			CREATE INDEX IF NOT EXISTS idx_playground_jobs_queue ON playground_jobs(queue);
			CREATE INDEX IF NOT EXISTS idx_playground_jobs_created_at ON playground_jobs(created_at);
		`,
	},
	{
		name: "002_create_job_state_history",
		sql: `
			CREATE TABLE IF NOT EXISTS job_state_history (
				id         INTEGER PRIMARY KEY AUTOINCREMENT,
				job_id     TEXT NOT NULL REFERENCES playground_jobs(id),
				from_state TEXT NOT NULL,
				to_state   TEXT NOT NULL,
				reason     TEXT DEFAULT '',
				timestamp  DATETIME NOT NULL DEFAULT (datetime('now'))
			);

			CREATE INDEX IF NOT EXISTS idx_job_state_history_job_id ON job_state_history(job_id);
		`,
	},
}

// RunMigrations applies all pending migrations.
func RunMigrations(ctx context.Context, db *sql.DB) error {
	// Create migrations tracking table
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS playground_migrations (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			name       TEXT NOT NULL UNIQUE,
			applied_at DATETIME NOT NULL DEFAULT (datetime('now'))
		)
	`)
	if err != nil {
		return fmt.Errorf("create migrations table: %w", err)
	}

	for _, m := range migrations {
		var count int
		err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM playground_migrations WHERE name = ?", m.name).Scan(&count)
		if err != nil {
			return fmt.Errorf("check migration %s: %w", m.name, err)
		}
		if count > 0 {
			continue
		}

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin tx for %s: %w", m.name, err)
		}

		if _, err := tx.ExecContext(ctx, m.sql); err != nil {
			tx.Rollback()
			return fmt.Errorf("apply migration %s: %w", m.name, err)
		}

		if _, err := tx.ExecContext(ctx, "INSERT INTO playground_migrations (name) VALUES (?)", m.name); err != nil {
			tx.Rollback()
			return fmt.Errorf("record migration %s: %w", m.name, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %s: %w", m.name, err)
		}

		slog.Info("applied migration", "name", m.name)
	}

	return nil
}
