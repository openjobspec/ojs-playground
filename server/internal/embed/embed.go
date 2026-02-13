package embed

import "embed"

// Dist contains the built SPA files from ui/dist/.
// The build script copies ui/dist/ into this directory before go build.
//
//go:embed all:dist
var Dist embed.FS
