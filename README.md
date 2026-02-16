# OJS Playground

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

Interactive development environment for the [Open Job Spec](https://openjobspec.org) standard. Define jobs, visualize lifecycle state machines, simulate retry behavior, compare backends, and generate SDK code — all in the browser.

## Quick Start

### Browser Mode (Zero Install)

Visit [play.openjobspec.org](https://play.openjobspec.org) — no installation required.

### Local Mode

```bash
npx ojs-playground dev
```

Or with Docker:

```bash
cd server/docker
docker compose up
```

Then open [http://localhost:4200](http://localhost:4200).

## Development

### UI (React + Vite)

```bash
cd ui
npm install
npm run dev          # Start dev server
npm run build        # Production build
npm test             # Run tests
npm run lint         # TypeScript check
```

### Server (Go)

```bash
cd server
make build           # Build binary
make run             # Build + run
make test            # Run tests
```

## Architecture

The playground operates in two modes:

- **Browser Mode**: Zero-install SPA with client-side simulation, schema-driven editing (Monaco), state machine visualization (React Flow), retry timeline (Recharts), and multi-language code generation.
- **Local Mode**: Go binary (or Docker) that executes real jobs against backends (Redis, Postgres, etc.) with SSE-streamed real-time updates, worker auto-discovery, chaos engineering controls, and conformance testing.

Both modes share the same React frontend. In Local Mode, the UI is embedded via `go:embed`.

## Project Structure

```
ojs-playground/
├── ui/                    # React SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── components/    # UI components (editor, visualization, codegen, shell)
│   │   ├── engine/        # Core logic (simulation, retry, validation, codegen)
│   │   ├── store/         # Zustand state management
│   │   └── hooks/         # React hooks
│   └── public/schema/     # OJS JSON Schemas
├── server/                # Go backend for Local Mode
│   ├── cmd/playground/    # CLI entry point
│   └── internal/          # Server packages (api, sse, backends, discovery, chaos)
└── npm/                   # npx distribution package
```

## Features

- **Schema-driven editor** — Monaco Editor with JSON Schema autocomplete and validation
- **Job lifecycle visualization** — Interactive state machine diagram with animated transitions
- **Retry behavior simulator** — Visual timeline with configurable backoff strategies
- **Multi-language code generation** — Go, JavaScript, Python, Ruby, Rust, Java
- **Backend comparison** — Side-by-side feature matrix for Redis, Postgres, Kafka, SQS, NATS
- **Shareable URLs** — LZ-String compressed state in URL hash
- **Guided tutorials** — Step-by-step interactive learning
- **Templates library** — 15+ pre-built job spec templates
- **Dark/light themes** — System-aware with manual toggle
- **Keyboard shortcuts** — Cmd+K (palette), Cmd+Enter (simulate), Cmd+Shift+C (copy code)

## License

Apache License 2.0 — see [LICENSE](LICENSE).
