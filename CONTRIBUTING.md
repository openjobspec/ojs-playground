# Contributing to OJS Playground

Thank you for your interest in contributing to the OJS Playground! This guide covers the development setup, coding conventions, and submission process.

## Development Setup

### Prerequisites

- Node.js 18+
- Go 1.22+ (for server development)
- Docker (optional, for Local Mode testing)

### UI Development

```bash
cd ui
npm install
npm run dev          # http://localhost:5173
```

### Server Development

```bash
cd server
make build
make run             # http://localhost:4200
```

## Project Structure

- `ui/src/engine/` — Core logic (simulation, retry, codegen, validation). Pure functions with no React dependencies. Unit tested.
- `ui/src/store/` — Zustand state management with slices pattern.
- `ui/src/components/` — React components organized by feature area.
- `ui/src/hooks/` — Shared React hooks.
- `server/internal/` — Go server packages.

## Coding Conventions

### TypeScript (UI)

- Strict mode enabled
- Use `type` imports for type-only imports
- Prefer named exports
- Follow existing patterns in `engine/` for pure logic, `components/` for UI

### Go (Server)

- Standard library conventions
- `go vet` must pass
- Error wrapping with `fmt.Errorf`

## Testing

### Running Tests

```bash
cd ui && npm test         # Vitest
cd server && make test    # Go test
```

### Writing Tests

- Engine logic: add tests in `engine/__tests__/` or `engine/codegen/__tests__/`
- Test files use `.test.ts` suffix
- Use `describe`/`it` pattern

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Ensure tests pass: `npm test`
5. Ensure TypeScript compiles: `npm run lint`
6. Submit a pull request

## Adding Code Generation Templates

To add a new language:

1. Add the language type to `CodegenLanguage` in `engine/types.ts`
2. Create generator functions in `engine/codegen/generator.ts`
3. Update `CodeActions.tsx` with file extension and install command
4. Update `CodegenPanel.tsx` with the language tab
5. Add tests in `engine/codegen/__tests__/generator.test.ts`

## Adding Job Spec Templates

Templates are defined in `engine/templates.ts`. Each template includes:

- `id`: Unique identifier
- `title`: Display name
- `description`: One-sentence description
- `category`: Grouping category
- `level`: Required conformance level (0-4)
- `spec`: Complete OJS job spec object

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
