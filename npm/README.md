# @openjobspec/playground

Command-line launcher for the OJS Playground.

The launcher downloads a platform-specific binary from the matching
`ojs-playground` GitHub release and then forwards CLI arguments to it. It reads
the release `checksums.txt`, verifies SHA-256 before installation, and installs
through an atomic rename so truncated downloads are never cached. Existing
cache entries are revalidated and replaced when corrupt.

A package version is publishable only after that release contains all four binaries:

- `ojs-playground-darwin-arm64`
- `ojs-playground-darwin-amd64`
- `ojs-playground-linux-arm64`
- `ojs-playground-linux-amd64`

Until matching release binaries are available, build the playground from source
or use the repository Dockerfile.
