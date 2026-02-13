import { describe, it, expect } from 'vitest'
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
      expect(code).toContain("'email.send'")
    })

    it('generates worker code', () => {
      const code = generateCode(DEFAULT_JOB, 'javascript', 'worker')
      expect(code).toContain('OJSWorker')
      expect(code).toContain('worker.register')
      expect(code).toContain("'email.send'")
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
  })
})
