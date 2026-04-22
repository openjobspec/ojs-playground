# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-09-02

### Added

- Release automation that cross-compiles, verifies, checksums, and attaches all
  four supported launcher binaries before publishing the npm launcher.
- Generated third-party notices containing the actual installed production
  dependency license and notice texts, included in embedded and Docker assets.

### Changed

- The Go binary version is injected from `npm/package.json` instead of a
  hard-coded constant.
- The npm launcher verifies `checksums.txt`, downloads through a temporary
  file, atomically installs only checksum-valid binaries, and repairs corrupt
  cached binaries without leaving partial files.

## [0.4.1] - 2026-04-21

### Changed

- Strengthened SQLite invalid-path test coverage.

## [0.4.0] - 2026-04-20

### Added
- Interactive browser-based playground for OJS job definitions
- Monaco Editor integration for job JSON editing with schema validation
- Job lifecycle state machine visualization using xyFlow
- Retry behavior simulation engine with visual timeline
- Backend comparison mode for Redis, PostgreSQL, and NATS characteristics
- Multi-language code generation (Go, JavaScript, Python, Java, Rust, Ruby)
- Tutorial mode with guided walkthroughs
- URL-based sharing for playground configurations
- Zustand state management with modular store slices
- Server component for playground hosting
- npm package (`ojs-playground`) for `npx ojs-playground dev`
- Makefile with build and development targets
- README with quick start and feature overview
