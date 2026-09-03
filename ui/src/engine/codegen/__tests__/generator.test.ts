import { describe, it, expect } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { generateCode } from '../generator'
import type { OJSJob } from '../../types'
import { DEFAULT_JOB } from '../../constants'

describe('generateCode', () => {
  describe('Go', () => {
    it('generates enqueue code', () => {
      const code = generateCode(DEFAULT_JOB, 'go', 'enqueue')
      expect(code).toContain('package main')
      expect(code).toContain('ojs.NewClient')
      expect(code).toContain('client.Enqueue')
      expect(code).toContain('"email.send"')
      expect(code).toContain('ojs.Args{')
    })

    it('generates worker code', () => {
      const code = generateCode(DEFAULT_JOB, 'go', 'worker')
      expect(code).toContain('ojs.NewWorker')
      expect(code).toContain('worker.Register')
      expect(code).toContain('"email.send"')
      expect(code).toContain('ojs.JobContext')
    })

    it('generates full code with both enqueue and worker', () => {
      const code = generateCode(DEFAULT_JOB, 'go', 'full')
      expect(code).toContain('=== Enqueue (Producer) ===')
      expect(code).toContain('=== Worker (Consumer) ===')
    })

    it('includes retry policy when present', () => {
      const code = generateCode(DEFAULT_JOB, 'go', 'enqueue')
      expect(code).toContain('ojs.WithRetry')
      expect(code).toContain('MaxAttempts: 3')
    })

    it('includes queue option for non-default queue', () => {
      const job: OJSJob = { ...DEFAULT_JOB, queue: 'email' }
      const code = generateCode(job, 'go', 'enqueue')
      expect(code).toContain('ojs.WithQueue("email")')
    })

    it('omits queue option for default queue', () => {
      const code = generateCode(DEFAULT_JOB, 'go', 'enqueue')
      expect(code).not.toContain('ojs.WithQueue')
    })
  })

  describe('JavaScript', () => {
    it('generates enqueue code', () => {
      const code = generateCode(DEFAULT_JOB, 'javascript', 'enqueue')
      expect(code).toContain('OJSClient')
      expect(code).toContain('client.enqueue')
      expect(code).toContain('"email.send"')
    })

    it('generates worker code', () => {
      const code = generateCode(DEFAULT_JOB, 'javascript', 'worker')
      expect(code).toContain('OJSWorker')
      expect(code).toContain('worker.register')
      expect(code).toContain('"email.send"')
    })

    it('generates full code', () => {
      const code = generateCode(DEFAULT_JOB, 'javascript', 'full')
      expect(code).toContain('=== Enqueue (Producer) ===')
      expect(code).toContain('=== Worker (Consumer) ===')
    })

    it('includes retry options when present', () => {
      const code = generateCode(DEFAULT_JOB, 'javascript', 'enqueue')
      expect(code).toContain('retry:')
      expect(code).toContain('maxAttempts: 3')
    })

    it('uses camelCase for JS', () => {
      const code = generateCode(DEFAULT_JOB, 'javascript', 'enqueue')
      expect(code).toContain('maxAttempts')
      expect(code).toContain('initialInterval')
    })
  })

  describe('Python', () => {
    it('generates enqueue code', () => {
      const code = generateCode(DEFAULT_JOB, 'python', 'enqueue')
      expect(code).toContain('OJSClient')
      expect(code).toContain('client.enqueue')
      expect(code).toContain('"email.send"')
      expect(code).toContain('asyncio.run')
    })

    it('generates worker code', () => {
      const code = generateCode(DEFAULT_JOB, 'python', 'worker')
      expect(code).toContain('OJSWorker')
      expect(code).toContain('@worker.register')
      expect(code).toContain('"email.send"')
      expect(code).toContain('handle_email_send')
    })

    it('generates full code', () => {
      const code = generateCode(DEFAULT_JOB, 'python', 'full')
      expect(code).toContain('Enqueue (Producer)')
      expect(code).toContain('Worker (Consumer)')
    })

    it('includes retry policy', () => {
      const code = generateCode(DEFAULT_JOB, 'python', 'enqueue')
      expect(code).toContain('RetryPolicy')
      expect(code).toContain('max_attempts=3')
    })
  })

  describe('Ruby', () => {
    it('generates enqueue code', () => {
      const code = generateCode(DEFAULT_JOB, 'ruby', 'enqueue')
      expect(code).toContain('OJS::Client')
      expect(code).toContain('client.enqueue')
      expect(code).toContain('"email.send"')
    })

    it('generates worker code', () => {
      const code = generateCode(DEFAULT_JOB, 'ruby', 'worker')
      expect(code).toContain('OJS::Worker')
      expect(code).toContain('worker.register')
      expect(code).toContain('"email.send"')
      expect(code).toContain('do |ctx|')
    })

    it('generates full code', () => {
      const code = generateCode(DEFAULT_JOB, 'ruby', 'full')
      expect(code).toContain('Enqueue (Producer)')
      expect(code).toContain('Worker (Consumer)')
    })
  })

  describe('Rust', () => {
    it('generates enqueue code', () => {
      const code = generateCode(DEFAULT_JOB, 'rust', 'enqueue')
      expect(code).toContain('OJSClient')
      expect(code).toContain('.enqueue')
      expect(code).toContain('"email.send"')
      expect(code).toContain('#[tokio::main]')
    })

    it('generates worker code', () => {
      const code = generateCode(DEFAULT_JOB, 'rust', 'worker')
      expect(code).toContain('OJSWorker')
      expect(code).toContain('.register')
      expect(code).toContain('"email.send"')
      expect(code).toContain('handle_email_send')
    })

    it('generates full code', () => {
      const code = generateCode(DEFAULT_JOB, 'rust', 'full')
      expect(code).toContain('Enqueue (Producer)')
      expect(code).toContain('Worker (Consumer)')
    })

    it('includes retry policy with builder', () => {
      const code = generateCode(DEFAULT_JOB, 'rust', 'enqueue')
      expect(code).toContain('RetryPolicy::builder()')
      expect(code).toContain('.max_attempts(3)')
    })
  })

  describe('Java', () => {
    it('generates enqueue code', () => {
      const code = generateCode(DEFAULT_JOB, 'java', 'enqueue')
      expect(code).toContain('OJSClient')
      expect(code).toContain('.enqueue')
      expect(code).toContain('"email.send"')
      expect(code).toContain('public class')
    })

    it('generates worker code', () => {
      const code = generateCode(DEFAULT_JOB, 'java', 'worker')
      expect(code).toContain('OJSWorker')
      expect(code).toContain('.register')
      expect(code).toContain('"email.send"')
      expect(code).toContain('EmailSendWorker')
    })

    it('generates full code', () => {
      const code = generateCode(DEFAULT_JOB, 'java', 'full')
      expect(code).toContain('Enqueue (Producer)')
      expect(code).toContain('Worker (Consumer)')
    })

    it('includes retry policy with builder', () => {
      const code = generateCode(DEFAULT_JOB, 'java', 'enqueue')
      expect(code).toContain('RetryPolicy.builder()')
      expect(code).toContain('.maxAttempts(3)')
    })
  })

  describe('edge cases', () => {
    it('handles empty args', () => {
      const job: OJSJob = { ...DEFAULT_JOB, args: [] }
      const goCode = generateCode(job, 'go', 'enqueue')
      const jsCode = generateCode(job, 'javascript', 'enqueue')
      const pyCode = generateCode(job, 'python', 'enqueue')
      expect(goCode).toContain('ojs.Args{}')
      expect(jsCode).toContain('{}')
      expect(pyCode).toContain('{}')
    })

    it('handles job with no retry policy', () => {
      const job: OJSJob = { ...DEFAULT_JOB, retry: undefined }
      const code = generateCode(job, 'go', 'enqueue')
      expect(code).not.toContain('ojs.WithRetry')
    })

    it('handles priority', () => {
      const job: OJSJob = { ...DEFAULT_JOB, priority: 10 }
      const code = generateCode(job, 'go', 'enqueue')
      expect(code).toContain('ojs.WithPriority(10)')
    })

    it('handles timeout', () => {
      const job: OJSJob = { ...DEFAULT_JOB, timeout: 60 }
      const goCode = generateCode(job, 'go', 'enqueue')
      expect(goCode).toContain('ojs.WithTimeout')
    })

    it('generates all 6 languages without errors', () => {
      const languages = ['go', 'javascript', 'python', 'ruby', 'rust', 'java'] as const
      const scopes = ['enqueue', 'worker', 'full'] as const
      for (const lang of languages) {
        for (const scope of scopes) {
          const code = generateCode(DEFAULT_JOB, lang, scope)
          expect(code).toBeTruthy()
          expect(code.length).toBeGreaterThan(50)
        }
      }
    })

    it('encodes adversarial values as data and produces parseable source', () => {
      const attack = [
        'quote" and apostrophe\'',
        'backslash\\ template ${process.exit(1)}',
        'ruby #{system("id")} comment // /*',
        'INJECTED();',
      ].join('\n')
      const job = {
        ...DEFAULT_JOB,
        type: attack,
        queue: attack,
        args: [attack, { [attack]: attack, nested: [attack, null, true] }],
        meta: { [attack]: attack },
        retry: {
          ...DEFAULT_JOB.retry,
          initial_interval: attack,
          max_interval: attack,
        },
      } as OJSJob

      const languages = ['go', 'javascript', 'python', 'ruby', 'rust', 'java'] as const
      for (const language of languages) {
        for (const scope of ['enqueue', 'worker'] as const) {
          const code = generateCode(job, language, scope)
          expect(code.split('\n')).not.toContain('INJECTED();')
          expect(code).not.toContain('\n/* INJECTED')
          assertParses(language, code)
        }
      }
    }, 20_000)
  })
})

function runParser(command: string, args: string[], input: string): void {
  const result = spawnSync(command, args, {
    input,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error && 'code' in result.error && result.error.code === 'ENOENT') return
  expect(result.status, `${command} parser failed:\n${result.stderr || result.stdout}`).toBe(0)
}

function assertParses(language: 'go' | 'javascript' | 'python' | 'ruby' | 'rust' | 'java', code: string): void {
  switch (language) {
    case 'go':
      runParser('gofmt', [], code)
      return
    case 'javascript':
      runParser('node', ['--input-type=module', '--check'], code)
      return
    case 'python':
      runParser('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], code)
      return
    case 'ruby':
      runParser('ruby', ['-c'], code)
      return
    case 'rust':
      runParser('rustfmt', ['--edition', '2021', '--emit', 'stdout'], code)
      return
    case 'java':
      assertJavaCompiles(code)
  }
}

function assertJavaCompiles(code: string): void {
  const probe = spawnSync('javac', ['-version'], { encoding: 'utf8' })
  if (probe.error && 'code' in probe.error && probe.error.code === 'ENOENT') return

  const className = /public class ([A-Za-z_][A-Za-z0-9_]*)/.exec(code)?.[1]
  expect(className).toBeTruthy()

  const dir = mkdtempSync(join(process.cwd(), '.codegen-java-'))
  try {
    const sdkDir = join(dir, 'org', 'openjobspec', 'sdk')
    const classesDir = join(dir, 'classes')
    mkdirSync(sdkDir, { recursive: true })
    mkdirSync(classesDir)
    writeFileSync(join(dir, `${className}.java`), code)
    writeFileSync(join(sdkDir, 'OJSClient.java'), `package org.openjobspec.sdk;
public class OJSClient {
  public static OJSClient create(String url) { return new OJSClient(); }
  public JobRequest enqueue(String type) { return new JobRequest(); }
}`)
    writeFileSync(join(sdkDir, 'JobRequest.java'), `package org.openjobspec.sdk;
import java.time.Duration;
import java.util.Map;
public class JobRequest {
  public JobRequest args(Map<String, Object> args) { return this; }
  public JobRequest queue(String queue) { return this; }
  public JobRequest retry(RetryPolicy retry) { return this; }
  public JobRequest meta(Map<String, Object> meta) { return this; }
  public JobRequest priority(int priority) { return this; }
  public JobRequest timeout(Duration timeout) { return this; }
  public Job send() { return new Job(); }
}`)
    writeFileSync(join(sdkDir, 'Job.java'), `package org.openjobspec.sdk;
public class Job {
  public String id() { return "id"; }
  public String state() { return "available"; }
}`)
    writeFileSync(join(sdkDir, 'RetryPolicy.java'), `package org.openjobspec.sdk;
import java.time.Duration;
public class RetryPolicy {
  public static Builder builder() { return new Builder(); }
  public static class Builder {
    public Builder maxAttempts(int value) { return this; }
    public Builder initialInterval(Duration value) { return this; }
    public Builder backoffCoefficient(double value) { return this; }
    public Builder maxInterval(Duration value) { return this; }
    public Builder jitter(boolean value) { return this; }
    public RetryPolicy build() { return new RetryPolicy(); }
  }
}`)
    writeFileSync(join(sdkDir, 'JobContext.java'), `package org.openjobspec.sdk;
import java.util.Map;
public class JobContext {
  public ContextJob job() { return new ContextJob(); }
  public static class ContextJob {
    public Map<String, Object> args() { return Map.of(); }
  }
}`)
    writeFileSync(join(sdkDir, 'OJSWorker.java'), `package org.openjobspec.sdk;
import java.util.Map;
public class OJSWorker {
  public static Builder builder(String url) { return new Builder(); }
  public static class Builder {
    public Builder queues(String queue) { return this; }
    public Builder concurrency(int count) { return this; }
    public OJSWorker build() { return new OJSWorker(); }
  }
  public interface Handler { Map<String, Object> handle(JobContext context); }
  public void register(String type, Handler handler) {}
  public void start() {}
  public void stop() {}
}`)

    const javaFiles = [
      join(dir, `${className}.java`),
      join(sdkDir, 'OJSClient.java'),
      join(sdkDir, 'JobRequest.java'),
      join(sdkDir, 'Job.java'),
      join(sdkDir, 'RetryPolicy.java'),
      join(sdkDir, 'JobContext.java'),
      join(sdkDir, 'OJSWorker.java'),
    ]
    const result = spawnSync('javac', ['-d', classesDir, ...javaFiles], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    })
    expect(result.status, `javac failed:\n${result.stderr || result.stdout}`).toBe(0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
