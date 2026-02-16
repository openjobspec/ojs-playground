/**
 * Web Component wrapper for the OJS Playground.
 *
 * Usage:
 *   <script src="https://play.openjobspec.org/ojs-playground.js"></script>
 *   <ojs-playground theme="dark" language="go" spec='{"type":"email.send"}'></ojs-playground>
 *
 * Attributes:
 *   - theme: "light" | "dark" | "system" (default: "system")
 *   - language: CodegenLanguage (default: "go")
 *   - spec: JSON string of job spec to preload
 *   - height: CSS height value (default: "500px")
 *   - readonly: boolean attribute — disables editing
 *
 * Events:
 *   - ojs-spec-change: Fired when the spec content changes. detail: { spec: string }
 *   - ojs-code-copy: Fired when code is copied. detail: { language: string, code: string }
 */

const PLAYGROUND_BASE_URL = 'https://play.openjobspec.org'

class OJSPlayground extends HTMLElement {
  private iframe: HTMLIFrameElement | null = null
  private shadow: ShadowRoot

  static get observedAttributes() {
    return ['theme', 'language', 'spec', 'height', 'readonly']
  }

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.render()
    window.addEventListener('message', this.handleMessage)
  }

  disconnectedCallback() {
    window.removeEventListener('message', this.handleMessage)
  }

  attributeChangedCallback() {
    this.render()
  }

  private handleMessage = (event: MessageEvent) => {
    if (event.source !== this.iframe?.contentWindow) return
    const { type, payload } = event.data ?? {}

    if (type === 'ojs-spec-change') {
      this.dispatchEvent(new CustomEvent('ojs-spec-change', { detail: payload }))
    } else if (type === 'ojs-code-copy') {
      this.dispatchEvent(new CustomEvent('ojs-code-copy', { detail: payload }))
    }
  }

  private render() {
    const theme = this.getAttribute('theme') ?? 'system'
    const language = this.getAttribute('language') ?? 'go'
    const spec = this.getAttribute('spec') ?? ''
    const height = this.getAttribute('height') ?? '500px'
    const readonly = this.hasAttribute('readonly')

    const params = new URLSearchParams({
      embed: '1',
      theme,
      language,
      ...(readonly ? { readonly: '1' } : {}),
      ...(spec ? { spec: encodeURIComponent(spec) } : {}),
    })

    const src = `${PLAYGROUND_BASE_URL}?${params.toString()}`

    this.shadow.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: ${height};
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
      </style>
      <iframe
        src="${src}"
        title="OJS Playground"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      ></iframe>
    `

    this.iframe = this.shadow.querySelector('iframe')
  }
}

// Register only if not already defined
if (typeof customElements !== 'undefined' && !customElements.get('ojs-playground')) {
  customElements.define('ojs-playground', OJSPlayground)
}

export { OJSPlayground }
