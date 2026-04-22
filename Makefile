.PHONY: all build-ui sync-embedded-ui release-embedded-ui build-server build test lint dev clean

all: build

# ---- UI ----

build-ui:
	cd ui && npm run build

sync-embedded-ui: build-ui
	node scripts/sync-embedded-ui.mjs

release-embedded-ui:
	cd ui && npm ci
	cd ui && npm run notices
	$(MAKE) sync-embedded-ui

test-ui:
	cd ui && npm test

lint-ui:
	cd ui && npm run lint

dev-ui:
	cd ui && npm run dev

# ---- Server ----

build-server: sync-embedded-ui
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
