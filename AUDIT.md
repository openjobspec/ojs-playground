# OJS Playground Finalization Audit

**Date:** 2026-08-12  
**Branch:** `refactor/clean-code-srp`  
**Scope:** `ojs-playground` only; no commits or staging performed.

## Implemented findings

> **0.5 release follow-up (2026-09-02):** Release automation now derives the
> Go and npm launcher version from `npm/package.json`, verifies all four local
> platform binaries plus checksums and legal files, attaches them to the GitHub
> release, and only then publishes npm. Third-party notices are generated from
> actual installed production dependency license/notice files and are verified
> in the embedded frontend and container image.

1. **Code generation security**
   - Added target-specific recursive literal encoders for JavaScript, Go, Python, Ruby, Rust, Java, and workflow C#.
   - Job type, queue, args, metadata, retry strings/numbers, workflow names, callback types, map keys, and generated identifiers no longer enter source as raw executable text.
   - Ruby interpolation, JS template syntax, comments, quotes, newlines, backslashes, nested values, and invalid identifiers are covered.
   - Enqueue/worker output is parsed by `gofmt`, Node, Python AST, Ruby, and `rustfmt`; Java is compiled against SDK stubs with `javac`.

2. **Project export**
   - Export now requires JSON-Schema-valid job state.
   - Project names and archive paths use bounded allowlisted slugs and static/sanitized filenames.
   - Replaced executable heredoc setup scripts with deterministic UTF-8 ustar archives (`.tar`).
   - Starter projects now contain one valid worker entry instead of concatenated duplicate program entry points.

3. **Share decoding**
   - Valid legacy `#/s/` and local `#/p/` links remain supported.
   - Added strict runtime object/enumeration/version validation, schema validation, recursive depth/node/key/string/array limits, and encoded/decoded byte limits.
   - Added a bounded LZ-String URI decoder that stops output and dictionary growth before allocation can exceed configured limits.
   - Invalid/corrupt/bomb links produce a recoverable visible toast and leave the application usable.

4. **Web component**
   - Added `vite.web-component.config.ts`, `build:web-component`, and a stable `/ojs-playground.js` ES module artifact.
   - The server embedded build includes the artifact and has a route smoke test.
   - The custom element validates `theme`, `language`, `spec`, `height`, and `readonly`; it constructs DOM nodes and style properties without attacker-controlled `innerHTML`.
   - Embed query options now actually configure theme/language/spec/read-only mode.

5. **Docker/CI**
   - CI and the Docker builder use Go 1.24.
   - Added the missing module checksums required by the Go 1.24 container toolchain.
   - Added `.dockerignore`; the final certification build context is 165.15 KB instead of hundreds of MB.

6. **Conformance service**
   - Auto-detects the actual `ojs-conformance/suites` root from common workspace working directories (133 core tests loaded locally).
   - Missing/empty suites return 503; a zero-test run can never report completed.
   - Implements every construct inventoried in the checked-out Level 0–4 core suites: typed matchers, status ranges/sets, `$exists`, `$type`, `$in`, `$or`, `$match`, `$size`, comparisons, array/string length and containment forms, approximate numbers, JSONPath indices/filters/wildcards, raw bodies, captures, WAIT/ASSERT, equality, exclusive claims, and paired parallel fetches.
   - Resolves `{{steps.<id>.response.status|headers|body...}}` in paths, headers, JSON bodies, assertion paths, and assertion values while preserving referenced JSON types.
   - Unknown matchers/references are explicit `runner_error` results and are never compared as misleading literals.
   - Step context is sequential within each test; the in-memory backend resets between tests, and reset-backed runs are serialized to preserve isolation.
   - Runs use application-owned contexts, not request contexts.
   - Added max concurrency, per-run DELETE cancellation, immutable response snapshots, count/TTL retention, periodic cleanup, and context-aware delays.

7. **Jobs and Monaco**
   - Job Detail consumes `state_history` from `GET /api/jobs/{id}`; a compatible paginated `/history` route also exists.
   - Monaco synchronizes template/share/reset/format/tab changes into its mounted model only when values differ, preserves selection, and suppresses programmatic feedback loops.
   - Tab content is now persisted per tab for both user and programmatic edits.

8. **Conformance panel**
   - Every start gets a generation and run-ID fence.
   - Start/poll responses, recursive poll timers, timeout timers, errors, URL changes, new runs, and unmount cleanup all verify the active generation/run before mutating state.
   - Results and toasts distinguish runner evaluation errors from genuine backend conformance failures.

9. **HTTP limits and backend snapshots**
   - Added reusable capped single-value JSON decoding with consistent 400/413 responses, including chunked bodies.
   - Playground-owned `/api/*` DTOs reject unknown fields; extensible `/ojs/v1/*` protocol DTOs use bounded lenient decoding.
   - Current enqueue options (`retry`, `unique`, `delay_until`, `expires_at`, priority, timeouts, tags) are accepted, unknown top-level envelope attributes are preserved, and worker protocol requests tolerate extension fields.
   - Applied body and per-field limits to API, OJS memory, AI, cloud-mode, chaos, worker, conformance, and server-share handlers.
   - Job/history pagination and worker fetch counts are clamped.
   - Memory jobs, raw JSON, tags, and timeout pointers are deeply cloned under lock for callbacks, responses, getters, and lists.

10. **Accessibility, lifecycle, and cleanup**
    - Editor tabs implement tablist/tab/tabpanel semantics, roving Left/Right/Home/End focus, selected/controls relationships, separate named close buttons, visible focus, and 44 px touch targets.
    - Mobile local-mode navigation exposes Workers, Chaos, Jobs, and Tests with 44 px targets.
    - Global shortcuts ignore Monaco and editable controls.
    - Fixed conditional React hooks in Retry Timeline found during dogfood.
    - Aborted/guarded stale Workers, Chaos, Job Detail, Job IDE, and local-mode requests/timers.
    - Recent job polling now updates by ID instead of duplicating rows.
    - Deleted dead duplicate persistence and unused i18n modules; wired URL-sync helpers; removed dead gzip scaffolding.
    - `npm run lint` now typechecks referenced TS projects.
    - Added focused SRP seams: language literals, bounded decompression, embed configuration, Monaco synchronization, semantic editor tabs, and strict Go HTTP decoding.

## Verification gates

### Go

| Gate | Result |
|---|---|
| Modified-file `gofmt` check | pass |
| `go test ./... -race -cover` | pass |
| `go vet ./...` | pass |
| `go build ./...` | pass |
| `make lint` | pass |

Coverage highlights: API 37.2%, backends 63.3%, conformance 58.6%, embed 76.9%, history 79.7%, HTTP JSON 40.0%, share 50.5%.

### UI/package

| Gate | Result |
|---|---|
| `npm ci` | pass |
| `npm run lint` | pass |
| `npm test -- --reporter=dot` | pass — 23 files / 181 tests |
| `npm run test:coverage -- --reporter=dot` | pass — 30.28% statements / 73.01% branches / 63.55% functions |
| `npm run build` | pass — SPA + `/ojs-playground.js` |
| `npm audit --audit-level=low` | pass — 0 vulnerabilities |
| `node --check server/internal/embed/dist/ojs-playground.js` | pass |
| `node --check npm/bin/ojs-playground.js` | pass |
| `npm pack --dry-run --json` (`npm/`) | pass — `@openjobspec/playground@0.2.0`, 2 files |

The conformance panel tests emit the existing React testing-environment `act(...)` warning in two timer-driven cases while all assertions and timers pass; the production browser console is clean.

### Native server integration

- `/api/health` returned `ok`.
- Internal `/api/jobs` rejected a typo field with 400.
- A complete OJS enqueue containing retry, unique, future `delay_until`, expiration, priority, visibility/timeout, idempotency, and extension fields returned 201 and preserved the supported/current envelope plus unknown top-level extension data.
- OJS fetch and ACK requests with extension fields returned 200; a trailing second JSON value returned 400.
- `/ojs-playground.js` returned 200.
- The checked-out 133-test Level 0–4 DSL inventory test passed, plus nine live representative real-suite tests against fresh in-memory backends.

### Actual Level 0 real-suite run

Run `019ff6b1-3009-7772-9e38-17e350a36b1e` against the final embedded native binary:

| Total | Passed | Failed | Skipped | Runner errors | Backend failures | Duration |
|---:|---:|---:|---:|---:|---:|---:|
| 65 | 33 | 32 | 0 | **0** | 32 | 563 ms |

The 32 failures are genuine in-memory backend gaps, not runner semantics:

| Backend gap | Tests |
|---|---:|
| Missing required/format validation for args, type, queue, and UUIDv7 IDs | 4 |
| Standard error envelope/catalog differences (`retryable`, code mapping, invalid payload/conflict/not-found/duplicate responses) | 11 |
| Missing job event endpoints/event response behavior | 2 |
| ACK/NACK response-envelope and retry/terminal lifecycle differences | 14 |
| Missing manifest endpoint | 1 |

Representative tests now passing include full current envelope/options, unknown-field preservation, priority bounds, future scheduling, fetch size/comparison matchers, exclusive concurrent claim, read-only equality, and reference-driven priority ordering. No failure contains an unresolved `{{steps...}}` token or a typed matcher compared as a literal.

### Docker

- `docker build -t ojs-playground:certification-final -f server/Dockerfile .` passed.
- Final image: `sha256:78365c00676995855794b68b145de9f248396460a6e103c57706501062660051` (23,233,661 bytes).
- Container smoke: health `ok`, web component 200, unavailable suites correctly return 503 in the standalone image.

## Agent-browser dogfood

Tested the final embedded server build at **375×812**, **768×900**, and **1440×1000**.

- No horizontal document overflow at any viewport.
- 375 px: Editor/Visualize/Code and secondary local tabs are reachable; primary mobile targets measured 44 px.
- 768 px: three panes render without document overflow.
- 1440 px: dark mode and reduced-motion media both apply.
- Editor tab ArrowLeft roved focus/selection and updated the tabpanel label; tab content survived add/switch.
- Cmd+K did not open the palette from Monaco; it did open from application chrome.
- Malicious `<img onerror>` explanation rendered escaped text: 0 images, 0 `onerror` nodes, no execution.
- Corrupt share hash showed “Unable to load shared playground…continue with a new spec” and did not crash.
- Built web component registered and honored theme/language/read-only; malicious height interpolation fell back to `500px`.
- Local mode was detected; actual L0 run reported 65 tests (never zero).
- Job Detail issued one `GET /api/jobs/{id}` and displayed the `available → cancelled` state history.
- Final browser `errors` and `console` were empty.

## Blockers

No certification-finding blockers remain: JSON decoding boundaries and the checked-out conformance DSL are fully covered, with zero runner errors in the real L0 run.

The 32 L0 backend conformance failures above remain product capability gaps if full Level 0 certification is required. The only non-failing test diagnostic is the React `act(...)` warning noted above.
