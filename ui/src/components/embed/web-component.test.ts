import { describe, expect, it } from 'vitest'
import { getEmbedOptions, normalizeEmbedDimension } from '@/engine/embed-config'
import './web-component'

describe('ojs-playground web component', () => {
  it('registers the custom element and maps documented attributes', () => {
    expect(customElements.get('ojs-playground')).toBeDefined()

    const element = document.createElement('ojs-playground')
    const spec = '{"specversion":"1.0","id":"019461a8-1a2b-7c3d-8e4f-5a6b7c8d9e0f","type":"email.send","queue":"default","args":[]}'
    element.setAttribute('theme', 'dark')
    element.setAttribute('language', 'python')
    element.setAttribute('spec', spec)
    element.setAttribute('height', '640px')
    element.setAttribute('readonly', '')
    document.body.appendChild(element)

    const iframe = element.shadowRoot?.querySelector('iframe')
    expect(iframe).not.toBeNull()
    const options = getEmbedOptions(new URL(iframe!.src).search)
    expect(options).toMatchObject({
      enabled: true,
      theme: 'dark',
      language: 'python',
      spec,
      readonly: true,
    })
    expect(element.style.getPropertyValue('--ojs-playground-height')).toBe('640px')
    expect(iframe?.title).toBe('OJS Playground')

    element.remove()
  })

  it('rejects attribute interpolation and falls back to safe values', () => {
    const element = document.createElement('ojs-playground')
    element.setAttribute('theme', 'dark" onload="alert(1)')
    element.setAttribute('language', 'go&evil')
    element.setAttribute('height', '500px; background: url(javascript:alert(1))')
    document.body.appendChild(element)

    const iframe = element.shadowRoot?.querySelector('iframe')
    const options = getEmbedOptions(new URL(iframe!.src).search)
    expect(options.theme).toBe('system')
    expect(options.language).toBe('go')
    expect(element.style.getPropertyValue('--ojs-playground-height')).toBe('500px')
    expect(element.shadowRoot?.querySelector('[onload]')).toBeNull()
    expect(element.shadowRoot?.textContent).not.toContain('javascript:alert')

    element.remove()
  })

  it('normalizes supported CSS dimensions only', () => {
    expect(normalizeEmbedDimension('75vh', '500px')).toBe('75vh')
    expect(normalizeEmbedDimension('320', '500px')).toBe('320px')
    expect(normalizeEmbedDimension('0px', '500px')).toBe('500px')
    expect(normalizeEmbedDimension('calc(100vh - 1px)', '500px')).toBe('500px')
  })
})
