import { describe, it, expect } from 'vitest'
import { explainJob, explainLineToHtml } from '../explain'
import type { OJSJob } from '../types'

describe('explainJob', () => {
  it('describes identity, args and retry policy', () => {
    const job: OJSJob = {
      type: 'email.send',
      queue: 'mail',
      args: ['a@example.com', 'Hi'],
      retry: { max_attempts: 5, initial_interval: 'PT10S', backoff_coefficient: 2 },
    } as OJSJob
    const lines = explainJob(job)
    expect(lines[0]).toContain('**email.send**')
    expect(lines[0]).toContain('**mail**')
    expect(lines.some((l) => l.includes('2 arguments'))).toBe(true)
    expect(lines.some((l) => l.includes('up to **5** attempts'))).toBe(true)
  })

  it('does not throw on a non-ISO-8601 retry interval', () => {
    const job = {
      type: 'x',
      queue: 'default',
      retry: { max_attempts: 3, initial_interval: '10s' },
    } as unknown as OJSJob
    expect(() => explainJob(job)).not.toThrow()
    // Falls back to the raw value rather than crashing.
    expect(explainJob(job).some((l) => l.includes('10s'))).toBe(true)
  })

  it('notes exactly-once when no retry policy is present', () => {
    const lines = explainJob({ type: 'x', queue: 'default' } as OJSJob)
    expect(lines.some((l) => l.includes('exactly once'))).toBe(true)
  })
})

describe('explainLineToHtml', () => {
  it('expands the intended bold and code markers', () => {
    expect(explainLineToHtml('a **b** c')).toBe(
      'a <strong class="text-foreground">b</strong> c'
    )
    expect(explainLineToHtml('run `x`')).toBe(
      'run <code class="bg-muted px-0.5 rounded text-[10px]">x</code>'
    )
  })

  it('escapes raw HTML metacharacters', () => {
    const html = explainLineToHtml('<script>alert(1)</script> & "q" \'s\'')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;')
    expect(html).toContain('&#39;')
  })

  it('neutralizes injection smuggled inside bold/code markers', () => {
    const html = explainLineToHtml('type is **<img src=x onerror=alert(1)>**')
    // The intended <strong> wrapper is still produced...
    expect(html).toContain('<strong class="text-foreground">')
    // ...but the payload is escaped, so no live <img> element is created.
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('produces no live markup for a malicious job type (deep-link XSS vector)', () => {
    const job = {
      type: '<img src=x onerror=alert(document.cookie)>',
      queue: 'default',
      args: [],
    } as unknown as OJSJob
    const html = explainJob(job).map(explainLineToHtml).join('\n')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})
