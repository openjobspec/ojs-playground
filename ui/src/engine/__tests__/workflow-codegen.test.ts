import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { generateCode, type WorkflowDesign } from '../workflow-designer'

describe('workflow code generation', () => {
  it('serializes adversarial workflow values without creating source tokens', () => {
    const attack = [
      'quote" apostrophe\' backslash\\',
      'template ${process.exit(1)} ruby #{system("id")}',
      'comment // /* */',
      'INJECTED();',
    ].join('\n')
    const design: WorkflowDesign = {
      name: attack,
      description: attack,
      nodes: [
        {
          id: 'one',
          type: 'job',
          label: attack,
          jobType: attack,
          queue: attack,
          args: { [attack]: [attack, { nested: attack }] },
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    }

    for (const language of ['go', 'javascript', 'python', 'ruby', 'rust', 'java', 'csharp']) {
      const code = generateCode(design, language)
      expect(code.split('\n')).not.toContain('INJECTED();')
      if (language !== 'java' && language !== 'csharp') {
        assertParses(language, code)
      }
    }
  })
})

function assertParses(language: string, code: string): void {
  const commands: Record<string, [string, string[]]> = {
    go: ['gofmt', []],
    javascript: ['node', ['--input-type=module', '--check']],
    python: ['python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())']],
    ruby: ['ruby', ['-c']],
    rust: ['rustfmt', ['--edition', '2021', '--emit', 'stdout']],
  }
  const [command, args] = commands[language]!
  const result = spawnSync(command, args, { input: code, encoding: 'utf8' })
  if (result.error && 'code' in result.error && result.error.code === 'ENOENT') return
  expect(result.status, `${language} parser failed:\n${result.stderr || result.stdout}`).toBe(0)
}
