import { normalizeEmbedDimension } from '@/engine/embed-config'

const THEMES = new Set(['light', 'dark', 'system'])
const LANGUAGES = new Set(['go', 'javascript', 'python', 'ruby', 'rust', 'java'])
const MAX_SPEC_LENGTH = 64 * 1024
const MAX_CODE_LENGTH = 1024 * 1024

const PLAYGROUND_BASE_URL = (() => {
  const moduleURL = new URL(/* @vite-ignore */ '.', import.meta.url)
  if (moduleURL.protocol === 'http:' || moduleURL.protocol === 'https:') return moduleURL
  if (typeof window !== 'undefined') return new URL('/', window.location.href)
  return new URL('https://play.openjobspec.org/')
})()

/**
 * Embeddable OJS Playground custom element.
 *
 * Attributes:
 * - theme: light | dark | system
 * - language: go | javascript | python | ruby | rust | java
 * - spec: JSON job envelope (64 KiB maximum)
 * - height: positive px, %, rem, em, vh, or vw value
 * - readonly: boolean attribute
 */
class OJSPlayground extends HTMLElement {
  private iframe: HTMLIFrameElement | null = null
  private readonly shadow: ShadowRoot

  static get observedAttributes(): string[] {
    return ['theme', 'language', 'spec', 'height', 'readonly']
  }

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  connectedCallback(): void {
    this.ensureDOM()
    this.update()
    window.addEventListener('message', this.handleMessage)
  }

  disconnectedCallback(): void {
    window.removeEventListener('message', this.handleMessage)
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.update()
  }

  private ensureDOM(): void {
    if (this.iframe) return

    const style = document.createElement('style')
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        height: var(--ojs-playground-height, 500px);
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }
      iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
      }
    `

    const iframe = document.createElement('iframe')
    iframe.title = 'OJS Playground'
    iframe.loading = 'lazy'
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms')
    this.shadow.append(style, iframe)
    this.iframe = iframe
  }

  private update(): void {
    if (!this.iframe) return

    const themeAttribute = this.getAttribute('theme')
    const languageAttribute = this.getAttribute('language')
    const specAttribute = this.getAttribute('spec')
    const theme = themeAttribute && THEMES.has(themeAttribute) ? themeAttribute : 'system'
    const language = languageAttribute && LANGUAGES.has(languageAttribute) ? languageAttribute : 'go'
    const spec = specAttribute && specAttribute.length <= MAX_SPEC_LENGTH ? specAttribute : ''
    const height = normalizeEmbedDimension(this.getAttribute('height'), '500px')

    this.style.setProperty('--ojs-playground-height', height)

    const url = new URL(PLAYGROUND_BASE_URL)
    url.searchParams.set('embed', '1')
    url.searchParams.set('theme', theme)
    url.searchParams.set('language', language)
    if (this.hasAttribute('readonly')) url.searchParams.set('readonly', '1')
    if (spec) url.searchParams.set('spec', encodeURIComponent(spec))
    this.iframe.src = url.toString()
  }

  private handleMessage = (event: MessageEvent): void => {
    if (event.source !== this.iframe?.contentWindow || !isRecord(event.data)) return
    const type = event.data.type
    const payload = event.data.payload
    if (!isRecord(payload)) return

    if (type === 'ojs-spec-change' && typeof payload.spec === 'string' && payload.spec.length <= MAX_SPEC_LENGTH) {
      this.dispatchEvent(new CustomEvent('ojs-spec-change', { detail: { spec: payload.spec } }))
    } else if (
      type === 'ojs-code-copy' &&
      typeof payload.language === 'string' &&
      LANGUAGES.has(payload.language) &&
      typeof payload.code === 'string' &&
      payload.code.length <= MAX_CODE_LENGTH
    ) {
      this.dispatchEvent(new CustomEvent('ojs-code-copy', {
        detail: { language: payload.language, code: payload.code },
      }))
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

if (typeof customElements !== 'undefined' && !customElements.get('ojs-playground')) {
  customElements.define('ojs-playground', OJSPlayground)
}

export { OJSPlayground }
