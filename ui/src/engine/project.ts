import type { CodegenLanguage, OJSJob } from './types'
import { generateCode } from './codegen/generator'
import { safePascalIdentifier } from './codegen/literals'
import { validateJob } from './validator'

export interface ProjectFile {
  name: string
  content: string
}

const MAX_SLUG_LENGTH = 48
const TAR_BLOCK_SIZE = 512

const projectConfigs: Record<CodegenLanguage, {
  configFile: string
  configContent: (slug: string) => string
  codeFile: (job: OJSJob) => string
  readme: (job: OJSJob) => string
}> = {
  go: {
    configFile: 'go.mod',
    configContent: (slug) => `module example.com/${slug}\n\ngo 1.24\n\nrequire github.com/openjobspec/ojs-go-sdk v0.1.0\n`,
    codeFile: () => 'main.go',
    readme: workerReadme('go run main.go'),
  },
  javascript: {
    configFile: 'package.json',
    configContent: (slug) => JSON.stringify({
      name: slug,
      version: '1.0.0',
      type: 'module',
      scripts: { start: 'node index.js' },
      dependencies: { '@openjobspec/sdk': '^0.1.0' },
    }, null, 2),
    codeFile: () => 'index.js',
    readme: workerReadme('npm install\nnpm start'),
  },
  python: {
    configFile: 'requirements.txt',
    configContent: () => 'openjobspec>=0.1.0\n',
    codeFile: () => 'worker.py',
    readme: workerReadme('pip install -r requirements.txt\npython worker.py'),
  },
  ruby: {
    configFile: 'Gemfile',
    configContent: () => "source 'https://rubygems.org'\n\ngem 'openjobspec'\n",
    codeFile: () => 'worker.rb',
    readme: workerReadme('bundle install\nruby worker.rb'),
  },
  rust: {
    configFile: 'Cargo.toml',
    configContent: (slug) => `[package]\nname = "${slug}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nojs-sdk = "0.1"\ntokio = { version = "1", features = ["full"] }\nserde_json = "1"\n`,
    codeFile: () => 'src/main.rs',
    readme: workerReadme('cargo run'),
  },
  java: {
    configFile: 'pom.xml',
    configContent: (slug) => `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>${slug}</artifactId>
  <version>1.0-SNAPSHOT</version>
  <properties>
    <maven.compiler.release>21</maven.compiler.release>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.openjobspec</groupId>
      <artifactId>ojs-java-sdk</artifactId>
      <version>0.1.0</version>
    </dependency>
  </dependencies>
</project>`,
    codeFile: (job) => `src/main/java/${safePascalIdentifier(job.type)}Worker.java`,
    readme: workerReadme('mvn compile'),
  },
}

function workerReadme(command: string): (job: OJSJob) => string {
  return (job) => `# ${job.type} Worker

OJS job worker generated from the OJS Playground.

## Quick Start

\`\`\`bash
${command}
\`\`\`
`
}

export function deriveProjectSlug(jobType: string): string {
  const normalized = jobType
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '')

  return `${normalized || 'ojs-job'}-worker`
}

function assertExportableJob(job: OJSJob): void {
  const validation = validateJob(job)
  if (!validation.valid) {
    const first = validation.errors[0]
    throw new Error(`Cannot export an invalid OJS job${first ? `: ${first.message}` : ''}`)
  }
}

function assertSafeArchivePath(path: string): void {
  if (
    path.length === 0 ||
    path.length > 240 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').some((part) => !part || part === '.' || part === '..' || !/^[A-Za-z0-9._-]+$/.test(part))
  ) {
    throw new Error(`Unsafe project filename: ${path}`)
  }
}

/**
 * Generate a schema-valid, standalone worker project.
 */
export function generateProjectFiles(job: OJSJob, language: CodegenLanguage): ProjectFile[] {
  assertExportableJob(job)

  const config = projectConfigs[language]
  const slug = deriveProjectSlug(job.type)
  const files = [
    { name: 'README.md', content: config.readme(job) },
    { name: config.configFile, content: config.configContent(slug) },
    { name: config.codeFile(job), content: generateCode(job, language, 'worker') },
    { name: 'spec.json', content: JSON.stringify(job, null, 2) },
  ]

  for (const file of files) assertSafeArchivePath(file.name)
  return files
}

/**
 * Build a deterministic ustar archive. File contents are UTF-8 data, never
 * interpolated into an executable shell script.
 */
export function buildProjectArchive(job: OJSJob, language: CodegenLanguage): Uint8Array {
  const slug = deriveProjectSlug(job.type)
  const files = generateProjectFiles(job, language)
  const encoder = new TextEncoder()
  const blocks: Uint8Array[] = []

  for (const file of files) {
    const archivePath = `${slug}/${file.name}`
    assertSafeArchivePath(archivePath)
    const content = encoder.encode(file.content)
    const header = createTarHeader(archivePath, content.length)
    blocks.push(header, content)
    const padding = (TAR_BLOCK_SIZE - (content.length % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE
    if (padding > 0) blocks.push(new Uint8Array(padding))
  }

  blocks.push(new Uint8Array(TAR_BLOCK_SIZE * 2))
  const size = blocks.reduce((total, block) => total + block.length, 0)
  const archive = new Uint8Array(size)
  let offset = 0
  for (const block of blocks) {
    archive.set(block, offset)
    offset += block.length
  }
  return archive
}

function createTarHeader(name: string, size: number): Uint8Array {
  const header = new Uint8Array(TAR_BLOCK_SIZE)
  writeTarPath(header, name)
  writeTarOctal(header, 100, 8, 0o644)
  writeTarOctal(header, 108, 8, 0)
  writeTarOctal(header, 116, 8, 0)
  writeTarOctal(header, 124, 12, size)
  writeTarOctal(header, 136, 12, 0)
  header.fill(0x20, 148, 156)
  header[156] = '0'.charCodeAt(0)
  writeTarText(header, 257, 6, 'ustar')
  writeTarField(header, 263, 2, '00')
  writeTarText(header, 265, 32, 'ojs')
  writeTarText(header, 297, 32, 'ojs')

  const checksum = header.reduce((total, byte) => total + byte, 0)
  const checksumText = checksum.toString(8).padStart(6, '0')
  writeTarField(header, 148, 6, checksumText)
  header[154] = 0
  header[155] = 0x20
  return header
}

function writeTarPath(target: Uint8Array, path: string): void {
  const encoder = new TextEncoder()
  if (encoder.encode(path).length <= 100) {
    writeTarField(target, 0, 100, path)
    return
  }

  const slashIndexes = Array.from(path.matchAll(/\//g), (match) => match.index)
  for (let index = slashIndexes.length - 1; index >= 0; index--) {
    const slash = slashIndexes[index]!
    const prefix = path.slice(0, slash)
    const name = path.slice(slash + 1)
    if (encoder.encode(prefix).length <= 155 && encoder.encode(name).length <= 100) {
      writeTarField(target, 0, 100, name)
      writeTarField(target, 345, 155, prefix)
      return
    }
  }

  throw new Error(`Archive path is too long: ${path}`)
}

function writeTarText(target: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = new TextEncoder().encode(value)
  if (bytes.length >= length) throw new Error(`Archive path is too long: ${value}`)
  target.set(bytes, offset)
}

function writeTarField(target: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = new TextEncoder().encode(value)
  if (bytes.length > length) throw new Error(`Archive path is too long: ${value}`)
  target.set(bytes, offset)
}

function writeTarOctal(target: Uint8Array, offset: number, length: number, value: number): void {
  const encoded = value.toString(8).padStart(length - 1, '0')
  writeTarText(target, offset, length, encoded)
}

export function downloadProjectArchive(job: OJSJob, language: CodegenLanguage): void {
  const archive = buildProjectArchive(job, language)
  const projectName = deriveProjectSlug(job.type)
  const blob = new Blob([archive], { type: 'application/x-tar' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${projectName}.tar`
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
