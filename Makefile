.PHONY: all build-ui build-server build test lint dev clean

all: build

# ---- UI ----

build-ui:
	cd ui && npm run build

test-ui:
	cd ui && npm test

lint-ui:
	cd ui && npm run lint

dev-ui:
	cd ui && npm run dev

# ---- Server ----

build-server: build-ui
	cd server && make build

test-server:
	cd server && make test

# ---- Combined ----

build: build-ui build-server

test: test-ui test-server

lint: lint-ui

dev:
	cd ui && npm run dev

clean:
	rm -rf ui/dist server/bin
