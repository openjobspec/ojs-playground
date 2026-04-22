import { describe, expect, it } from 'vitest'
import {
  buildProjectArchive,
  deriveProjectSlug,
  generateProjectFiles,
} from '../project'
import { DEFAULT_JOB } from '../constants'
import type { OJSJob } from '../types'

describe('project export', () => {
  it('requires a schema-valid job', () => {
    const malicious = {
      ...DEFAULT_JOB,
      type: '../../owned\n$(touch pwned)',
    } as OJSJob

    expect(() => generateProjectFiles(malicious, 'go')).toThrow(/invalid OJS job/i)
    expect(() => buildProjectArchive(malicious, 'go')).toThrow(/invalid OJS job/i)
  })

  it('derives a bounded allowlisted slug', () => {
    const slug = deriveProjectSlug('../../A B;$(touch owned)\\evil')
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*-worker$/)
    expect(slug).not.toContain('/')
    expect(slug).not.toContain('\\')
    expect(slug.length).toBeLessThanOrEqual(55)
  })

  it('archives malicious argument content as inert UTF-8 data', () => {
    const attack = 'OJSEOF\n$(touch owned)\n../../escape\n`whoami`\n${process.exit(1)}'
    const job: OJSJob = {
      ...DEFAULT_JOB,
      args: [attack, { path: '../../escape', value: attack }],
      meta: { attack },
    }

    const entries = readTar(buildProjectArchive(job, 'javascript'))
    expect([...entries.keys()].every(isSafeArchivePath)).toBe(true)
    expect([...entries.keys()].some((name) => name.endsWith('.sh'))).toBe(false)
    const archivedSpec = JSON.parse(entries.get('email-send-worker/spec.json')!) as OJSJob
    expect(archivedSpec.args[0]).toBe(attack)
    expect(entries.get('email-send-worker/index.js')).toContain('"email.send"')
  })

  it('uses a Java filename matching the generated public class', () => {
    const files = generateProjectFiles(DEFAULT_JOB, 'java')
    const source = files.find((file) => file.name.endsWith('.java'))
    expect(source).toBeDefined()
    const className = /public class ([A-Za-z_][A-Za-z0-9_]*)/.exec(source!.content)?.[1]
    expect(source!.name).toBe(`src/main/java/${className}.java`)
  })
})

function isSafeArchivePath(path: string): boolean {
  return !path.startsWith('/') &&
    !path.includes('\\') &&
    path.split('/').every((part) => Boolean(part) && part !== '.' && part !== '..' && /^[A-Za-z0-9._-]+$/.test(part))
}

function readTar(archive: Uint8Array): Map<string, string> {
  const entries = new Map<string, string>()
  const decoder = new TextDecoder()
  let offset = 0

  while (offset + 512 <= archive.length) {
    const header = archive.slice(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const name = readString(header.slice(0, 100))
    const prefix = readString(header.slice(345, 500))
    const path = prefix ? `${prefix}/${name}` : name
    const sizeText = readString(header.slice(124, 136)).trim()
    const size = Number.parseInt(sizeText || '0', 8)
    const contentStart = offset + 512
    const content = archive.slice(contentStart, contentStart + size)
    entries.set(path, decoder.decode(content))
    offset = contentStart + Math.ceil(size / 512) * 512
  }

  return entries
}

function readString(bytes: Uint8Array): string {
  const end = bytes.indexOf(0)
  return new TextDecoder().decode(end === -1 ? bytes : bytes.slice(0, end))
}
