# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0](https://github.com/openjobspec/ojs-playground/compare/v0.1.0...v0.2.0) (2026-02-28)


### Features

* add initial project structure ([a1773f0](https://github.com/openjobspec/ojs-playground/commit/a1773f08fe52386622bf2ffc47c9cc2b7199e374))
* add job sharing via short links ([fb693bf](https://github.com/openjobspec/ojs-playground/commit/fb693bf3de49603f6635f1f2620bb72f83354a0b))
* add live code editor with syntax highlighting ([1211f77](https://github.com/openjobspec/ojs-playground/commit/1211f7743d1a0d45d4f15e08c60295cd2f0ac10c))
* add live job state visualization ([807de3c](https://github.com/openjobspec/ojs-playground/commit/807de3c42918d5362dff6df45851ddf77b94a158))
* add workflow builder UI ([f35e48b](https://github.com/openjobspec/ojs-playground/commit/f35e48bdde160af39a9f687c75191a654511b7e8))
* add workflow visualization panel to playground UI ([8568a85](https://github.com/openjobspec/ojs-playground/commit/8568a85eefab2c289538079d6ec9fb723783813b))


### Bug Fixes

* correct WebSocket reconnection in playground ([ba0c051](https://github.com/openjobspec/ojs-playground/commit/ba0c0511b636244c47b986da8f2f22db0adf218b))
* resolve WebSocket reconnection in live job monitor ([8cc66da](https://github.com/openjobspec/ojs-playground/commit/8cc66daba0b8e23636f460a892c405810b9c253d))
* resolve WebSocket reconnection in sandbox ([c2cddef](https://github.com/openjobspec/ojs-playground/commit/c2cddefc15348930eb1d0f18cb337580587c2aac))

## [Unreleased]

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
