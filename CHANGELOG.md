# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2026-02-17)


### Features

* **npm:** add npx distribution wrapper ([313af29](https://github.com/openjobspec/ojs-playground/commit/313af29cf40f55c270e9e579ce822c8088b741a3))
* **server:** add Go backend with embedded UI and dev server ([8f414d3](https://github.com/openjobspec/ojs-playground/commit/8f414d391782310397e5048a84e2f617547ea0c9))
* **ui/engine:** add analytics event tracking ([1d69641](https://github.com/openjobspec/ojs-playground/commit/1d69641acf892c4323ca8069cda98a0225acddc7))
* **ui/engine:** add bulk operations engine with tests ([ed0340d](https://github.com/openjobspec/ojs-playground/commit/ed0340d800fc8a29a94a714bb0c400d598cd813b))
* **ui/engine:** add cron and batch workflow job templates ([26aee19](https://github.com/openjobspec/ojs-playground/commit/26aee19c45c1d7078c9208ae1e3f044520189cb1))
* **ui/engine:** add cron expression parser with tests ([c23338e](https://github.com/openjobspec/ojs-playground/commit/c23338e55be74746a61a0e7a85a7f91b8bb26411))
* **ui/engine:** add localStorage fallback for long share URLs ([78fc466](https://github.com/openjobspec/ojs-playground/commit/78fc4664bda1f351bd4e84b3b8aa2097eacface5))
* **ui/engine:** add payload size validation with tests ([f4274f8](https://github.com/openjobspec/ojs-playground/commit/f4274f83c5cadf57bda949f8546cbf2eb671cebd))
* **ui/engine:** add rate limiting simulation with tests ([d5f7ae9](https://github.com/openjobspec/ojs-playground/commit/d5f7ae9cb2eab5ee1acf3c6ad7dc8493d615594b))
* **ui/engine:** add timeout, progress, DLQ, backpressure, and workflow simulation scenarios ([54c55c3](https://github.com/openjobspec/ojs-playground/commit/54c55c3031a0435af1e3a5ec8c9fbe4171f0e9f2))
* **ui/engine:** export new engine modules ([d58f153](https://github.com/openjobspec/ojs-playground/commit/d58f153a68eab4916ddd7c06be06ff8d813cb4bb))
* **ui/engine:** extend type definitions for cron, timeout, progress, rate limiting, and workflows ([1435fc8](https://github.com/openjobspec/ojs-playground/commit/1435fc87b2e73eca606e0484d050081fac813250))
* **ui:** add baseline comparison for simulation results ([76cac7d](https://github.com/openjobspec/ojs-playground/commit/76cac7d9f19f9505083bc13b38749f65f028533a))
* **ui:** add cron, DLQ, backpressure, queue config, and middleware panels ([ce31e9d](https://github.com/openjobspec/ojs-playground/commit/ce31e9d20f6e9e153884c1c9efd97eacb2d8bf58))
* **ui:** add DAG visualization and retry controls components ([e99954c](https://github.com/openjobspec/ojs-playground/commit/e99954ce1be21bf3a9a0ae02860adf951cbb9686))
* **ui:** add embeddable web component ([09258b2](https://github.com/openjobspec/ojs-playground/commit/09258b2a428f9702b73089760e6106dc854effa7))
* **ui:** add i18n infrastructure ([f3184d2](https://github.com/openjobspec/ojs-playground/commit/f3184d23e8b67bdbed4d6a8246716fd4761049df))
* **ui:** add local development panels ([62caeb0](https://github.com/openjobspec/ojs-playground/commit/62caeb0f73ee62faae2fc6b27aa8ae244f86e77e))
* **ui:** add markdown export to backend comparison panel ([cfa852f](https://github.com/openjobspec/ojs-playground/commit/cfa852f0a75b292bb2d1c7b165ea4a0a9d89b783))
* **ui:** add payload size indicator to editor toolbar ([2b7e885](https://github.com/openjobspec/ojs-playground/commit/2b7e8858a14972a147e5ecf54c221b4986f584d5))
* **ui:** add playground React SPA with editor, visualization, and codegen ([f352bec](https://github.com/openjobspec/ojs-playground/commit/f352bece44541eafd5d1a4abd9d27855a550a492))
* **ui:** add reduced motion accessibility support ([7c3c63f](https://github.com/openjobspec/ojs-playground/commit/7c3c63f63268bff51f5ef949a69d417f904befa5))
* **ui:** add visualization panel tabs and a11y announcements ([90ca562](https://github.com/openjobspec/ojs-playground/commit/90ca562c35c5232038a356da785def4b7f5d1f21))
* **ui:** integrate analytics tracking in app and codegen ([3127c16](https://github.com/openjobspec/ojs-playground/commit/3127c16af4cb8c66c715b1b0f6c8db63933ac344))
* **ui:** refine shell components and add command palette shortcut ([4a0af49](https://github.com/openjobspec/ojs-playground/commit/4a0af495181684e2cbce53cc7d44f31264631861))
* **ui:** register new panel tabs in shell layout ([52df8f2](https://github.com/openjobspec/ojs-playground/commit/52df8f2034d7a5c5c366b7c084543b377050a297))


### Bug Fixes

* **ui:** remove unused imports and variables ([6130f0a](https://github.com/openjobspec/ojs-playground/commit/6130f0ab634c200dde083544a60791f140d620cf))
* **ui:** resolve TypeScript strict-mode type errors ([1e1c8a6](https://github.com/openjobspec/ojs-playground/commit/1e1c8a6680bdd515a3001159bde332e041a59dee))

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
