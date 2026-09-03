# OJS Playground
[![Stability: beta](https://img.shields.io/badge/stability-beta-yellow.svg)](https://openjobspec.org/governance/stability/)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

Interactive development environment for the [Open Job Spec](https://openjobspec.org) standard. Define jobs, visualize lifecycle state machines, simulate retry behavior, compare backends, and generate SDK code — all in the browser.

## Quick Start

### Browser Mode (Zero Install)

Visit [play.openjobspec.org](https://play.openjobspec.org) — no installation required.

### Local Mode

Build and run from source:

```bash
make build
./server/bin/ojs-playground dev
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
npm ci
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
- **Local Mode**: Go binary (or Docker) with an embedded in-memory OJS backend,
  SSE-streamed real-time updates, worker auto-discovery, chaos engineering
  controls, and conformance testing against configured HTTP targets.

Both modes share the same React frontend. In Local Mode, the UI is embedded via `go:embed`.

### Reproducible embedded frontend

The checked-in files under `server/internal/embed/dist/` are built from the
locked UI dependency graph. Regenerate them without dependency drift:

```bash
make release-embedded-ui
git diff -- server/internal/embed/dist THIRD_PARTY_NOTICES.md
```

This runs `npm ci` from `ui/package-lock.json`, verifies the generated
third-party notices, builds both the SPA and web component, and replaces the
embedded asset directory. Release artifacts that contain the embedded frontend
must ship `LICENSE` and `THIRD_PARTY_NOTICES.md`; the Docker image includes both
under `/licenses`.

### Release ordering

Pushing a `vX.Y.Z` tag runs `.github/workflows/release.yml`. The workflow
validates the tag against `npm/package.json`, rebuilds the embedded frontend,
cross-compiles all four supported binaries, verifies their checksums and legal
files locally, attaches the complete set to the GitHub release, and only then
publishes `@openjobspec/playground`. The npm launcher always constructs its
download URL from its own package version.

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
├── embed/                 # Embeddable widget for documentation sites
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

### Job IDE (GraphiQL-like Experience)
- **Left pane**: JSON job definition editor with templates (simple, retry, scheduled, workflow, batch)
- **Right pane**: Live job state transitions visualization
- **Bottom pane**: Execution log with timestamps
- **Server connection**: Connect to any OJS server or use browser simulation mode

## Embeddable Widget

Drop an OJS playground into any documentation site with a single script tag:

```html
<script
  src="https://playground.openjobspec.org/embed.js"
  data-url="http://localhost:8080"
  data-theme="dark">
</script>
```

Configurable theme, size, and server URL. See [`embed/README.md`](embed/README.md) for details.

### Web Component

The production UI build produces `ui/dist/ojs-playground.js`. Serve that file
from the same origin as the rest of the playground deployment:

```html
<script type="module" src="/ojs-playground.js"></script>
<ojs-playground
  theme="dark"
  language="go"
  height="500px"
  spec='{"specversion":"1.0","id":"019461a8-1a2b-7c3d-8e4f-5a6b7c8d9e0f","type":"email.send","queue":"default","args":[]}'>
</ojs-playground>
```

Supported attributes are `theme` (`light`, `dark`, `system`), `language`, `spec`
(up to 64 KiB), `height` (a positive simple CSS length), and boolean `readonly`.
The element emits `ojs-spec-change` and `ojs-code-copy` custom events.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
Third-party software bundled into the embedded frontend is listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
