.PHONY: dev build build-all docker test lint clean copy-ui

VERSION ?= 0.1.0
BINARY  := bin/ojs-playground
GOFLAGS := -ldflags="-s -w -X main.version=$(VERSION)"

# Development: build UI and run server
dev: copy-ui
	go run ./cmd/playground dev --no-scan --open=false

# Copy UI dist into embed directory
copy-ui:
	rm -rf internal/embed/dist
	cp -r ../ui/dist internal/embed/dist

# Build server binary (assumes UI is already copied)
build: copy-ui
	go build $(GOFLAGS) -o $(BINARY) ./cmd/playground

# Build for all platforms
build-all: copy-ui
	GOOS=darwin GOARCH=arm64 go build $(GOFLAGS) -o bin/ojs-playground-darwin-arm64 ./cmd/playground
	GOOS=darwin GOARCH=amd64 go build $(GOFLAGS) -o bin/ojs-playground-darwin-amd64 ./cmd/playground
	GOOS=linux  GOARCH=amd64 go build $(GOFLAGS) -o bin/ojs-playground-linux-amd64  ./cmd/playground
	GOOS=linux  GOARCH=arm64 go build $(GOFLAGS) -o bin/ojs-playground-linux-arm64  ./cmd/playground

# Build Docker image
docker:
	docker build -t ojs-playground:$(VERSION) -f Dockerfile ..

# Run tests
test:
	go test ./... -race -cover

# Lint
lint:
	go vet ./...

# Clean build artifacts
clean:
	rm -rf bin/
	rm -rf internal/embed/dist
