# OJS Playground — Embeddable Widget

Drop-in widget that lets documentation sites embed a live OJS interaction panel. Users can edit a job JSON payload, send it to any OJS-compatible server, and see the response — all inside an iframe.

> **Status**: Experimental — validating whether doc sites want embedded OJS interaction.

## Quick Start

The legacy iframe widget is distributed from this repository and is not
currently hosted at a public `embed.js` endpoint. Copy `embed/embed.js` and
`embed/embed.html` to the same directory on your static host, then add:

```html
<script
  src="/ojs-embed/embed.js"
  data-url="http://localhost:8080"
  data-theme="dark">
</script>
```

The script injects an iframe containing a minimal job editor with an **Enqueue** button and a response viewer.

## Configuration

All options are set via `data-*` attributes on the script tag:

| Attribute      | Default                  | Description                              |
|----------------|--------------------------|------------------------------------------|
| `data-url`     | `http://localhost:8080`  | Base URL of the OJS server               |
| `data-theme`   | `light`                  | Color theme: `light` or `dark`           |
| `data-width`   | `100%`                   | Widget width (CSS value or bare number)  |
| `data-height`  | `300`                    | Widget height in pixels                  |

## Examples

### Light theme (default)

```html
<script
  src="/ojs-embed/embed.js"
  data-url="https://demo.openjobspec.org"
  data-theme="light"
  data-width="500"
  data-height="350">
</script>
```

### Dark theme, full width

```html
<script
  src="/ojs-embed/embed.js"
  data-url="https://demo.openjobspec.org"
  data-theme="dark"
  data-width="100%"
  data-height="400">
</script>
```

### Direct iframe (no JS)

If you prefer not to use the loader script, embed the HTML directly:

```html
<iframe
  src="/ojs-embed/embed.html?url=http://localhost:8080&theme=dark"
  width="100%"
  height="300"
  style="border:none;border-radius:8px"
  title="OJS Playground"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin allow-forms">
</iframe>
```

## How It Works

```
┌─────────────────────────────────────────────┐
│  Host page                                  │
│  ┌───────────────────────────────────────┐  │
│  │  iframe (embed.html)                  │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  JSON editor (textarea)         │  │  │
│  │  ├─────────────────────────────────┤  │  │
│  │  │  [Enqueue]           status     │  │  │
│  │  ├─────────────────────────────────┤  │  │
│  │  │  Response (JSON)                │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  embed.js handles iframe creation &         │
│  auto-resize via postMessage                │
└─────────────────────────────────────────────┘
```

1. **embed.js** reads `data-*` attributes, creates an iframe pointing to `embed.html` with URL params.
2. **embed.html** renders a minimal editor UI. On click, it `fetch()`es `POST /jobs` against the configured OJS server.
3. After receiving a response, the iframe sends a `postMessage` to the parent so `embed.js` can auto-resize the iframe height.

## Keyboard Shortcuts

| Shortcut         | Action           |
|------------------|------------------|
| `Ctrl/⌘ + Enter` | Enqueue job      |
| `Tab`            | Insert two spaces |

## Self-Hosting

To self-host the widget, copy `embed.html` and `embed.js` to your static file server. The script auto-resolves `embed.html` relative to its own `src` URL — no configuration needed.

For new integrations, prefer the web component produced by
`cd ui && npm ci && npm run build`. Serve `ui/dist/ojs-playground.js` from your
deployment and use the `<ojs-playground>` example in the repository README.

<!-- Screenshot placeholder: replace with actual screenshot -->
<!-- ![OJS Playground Widget](./screenshot.png) -->

## License

Apache License 2.0 — see [LICENSE](../LICENSE).
