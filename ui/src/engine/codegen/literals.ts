type JSONRecord = Record<string, unknown>

const PYTHON_KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'false', 'finally', 'for', 'from',
  'global', 'if', 'import', 'in', 'is', 'lambda', 'none', 'nonlocal', 'not',
  'or', 'pass', 'raise', 'return', 'true', 'try', 'while', 'with', 'yield',
])

const RUST_KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else',
  'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop',
  'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self',
  'static', 'struct', 'super', 'trait', 'true', 'type', 'union', 'unsafe',
  'use', 'where', 'while',
].map((keyword) => keyword.toLowerCase()))

function entries(value: unknown): [string, unknown][] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as JSONRecord)
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function integerLiteral(value: unknown): string | null {
  const number = safeNumber(value)
  return number !== null && Number.isInteger(number) ? String(number) : null
}

export function numberLiteral(value: unknown): string | null {
  const number = safeNumber(value)
  return number === null ? null : String(number)
}

export function booleanLiteral(value: unknown): string | null {
  return typeof value === 'boolean' ? String(value) : null
}

export function jsString(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function jsLiteral(value: unknown): string {
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return 'null'
    return serialized
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
  } catch {
    return 'null'
  }
}

function doubleQuotedString(
  value: string,
  options: { rubyInterpolation?: boolean; unicodeStyle?: 'go' | 'rust' | 'java' | 'csharp' } = {},
): string {
  let result = '"'
  const chars = Array.from(value)

  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]!
    const codePoint = char.codePointAt(0)!

    if (char === '"') result += '\\"'
    else if (char === '\\') result += '\\\\'
    else if (char === '\n') result += '\\n'
    else if (char === '\r') result += '\\r'
    else if (char === '\t') result += '\\t'
    else if (char === '\b') result += options.unicodeStyle === 'rust' ? '\\u{8}' : '\\b'
    else if (char === '\f') result += options.unicodeStyle === 'rust' ? '\\u{c}' : '\\f'
    else if (options.rubyInterpolation && char === '#' && ['{', '$', '@'].includes(chars[index + 1] ?? '')) {
      result += '\\#'
    } else if (codePoint < 0x20 || codePoint === 0x7f) {
      if (options.unicodeStyle === 'rust') result += `\\u{${codePoint.toString(16)}}`
      else if (options.unicodeStyle === 'java') result += `\\${codePoint.toString(8).padStart(3, '0')}`
      else result += `\\u${codePoint.toString(16).padStart(4, '0')}`
    } else if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      result += options.unicodeStyle === 'rust' ? '\\u{fffd}' : '\\uFFFD'
    } else {
      result += char
    }
  }

  return result + '"'
}

export function goString(value: string): string {
  return doubleQuotedString(value, { unicodeStyle: 'go' })
}

export function goLiteral(value: unknown): string {
  if (value === null) return 'nil'
  if (typeof value === 'string') return goString(value)
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'nil'
  if (Array.isArray(value)) return `[]any{${value.map(goLiteral).join(', ')}}`
  if (typeof value === 'object') {
    return `map[string]any{${entries(value)
      .map(([key, item]) => `${goString(key)}: ${goLiteral(item)}`)
      .join(', ')}}`
  }
  return 'nil'
}

export function pythonString(value: string): string {
  return jsString(value)
}

export function pythonLiteral(value: unknown): string {
  if (value === null) return 'None'
  if (typeof value === 'string') return pythonString(value)
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'None'
  if (Array.isArray(value)) return `[${value.map(pythonLiteral).join(', ')}]`
  if (typeof value === 'object') {
    return `{${entries(value)
      .map(([key, item]) => `${pythonString(key)}: ${pythonLiteral(item)}`)
      .join(', ')}}`
  }
  return 'None'
}

export function rubyString(value: string): string {
  return doubleQuotedString(value, { rubyInterpolation: true })
}

export function rubyLiteral(value: unknown): string {
  if (value === null) return 'nil'
  if (typeof value === 'string') return rubyString(value)
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'nil'
  if (Array.isArray(value)) return `[${value.map(rubyLiteral).join(', ')}]`
  if (typeof value === 'object') {
    return `{${entries(value)
      .map(([key, item]) => `${rubyString(key)} => ${rubyLiteral(item)}`)
      .join(', ')}}`
  }
  return 'nil'
}

export function rustString(value: string): string {
  return doubleQuotedString(value, { unicodeStyle: 'rust' })
}

export function rustLiteral(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return rustString(value)
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (Array.isArray(value)) return `[${value.map(rustLiteral).join(', ')}]`
  if (typeof value === 'object') {
    return `{${entries(value)
      .map(([key, item]) => `${rustString(key)}: ${rustLiteral(item)}`)
      .join(', ')}}`
  }
  return 'null'
}

export function javaString(value: string): string {
  return doubleQuotedString(value, { unicodeStyle: 'java' })
}

export function javaLiteral(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return javaString(value)
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'null'
    if (Number.isInteger(value) && Math.abs(value) <= 2_147_483_647) return String(value)
    if (Number.isInteger(value) && Number.isSafeInteger(value)) return `${value}L`
    return `${value}d`
  }
  if (Array.isArray(value)) return `listOf(${value.map(javaLiteral).join(', ')})`
  if (typeof value === 'object') {
    return `mapOf(${entries(value)
      .flatMap(([key, item]) => [javaString(key), javaLiteral(item)])
      .join(', ')})`
  }
  return 'null'
}

export function csharpString(value: string): string {
  return doubleQuotedString(value, { unicodeStyle: 'csharp' })
}

export function csharpLiteral(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return csharpString(value)
  if (typeof value === 'boolean') return String(value).toLowerCase()
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'null'
    return Number.isInteger(value) ? String(value) : `${value}d`
  }
  if (Array.isArray(value)) return `new object?[] { ${value.map(csharpLiteral).join(', ')} }`
  if (typeof value === 'object') {
    return `new Dictionary<string, object?> { ${entries(value)
      .map(([key, item]) => `[${csharpString(key)}] = ${csharpLiteral(item)}`)
      .join(', ')} }`
  }
  return 'null'
}

function identifierWords(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
}

export function safePascalIdentifier(value: string, fallback = 'Job'): string {
  const words = identifierWords(value)
  let identifier = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
  if (!identifier) identifier = fallback
  if (/^[0-9]/.test(identifier)) identifier = fallback + identifier
  return identifier.slice(0, 80)
}

export function safeSnakeIdentifier(
  value: string,
  fallback = 'job',
  language: 'python' | 'rust' = 'python',
): string {
  let identifier = identifierWords(value).map((word) => word.toLowerCase()).join('_')
  if (!identifier) identifier = fallback
  const keywords = language === 'rust' ? RUST_KEYWORDS : PYTHON_KEYWORDS
  if (/^[0-9]/.test(identifier) || keywords.has(identifier)) identifier = `${fallback}_${identifier}`
  return identifier.slice(0, 80)
}

export function safeCamelIdentifier(value: string, fallback = 'job'): string {
  const pascal = safePascalIdentifier(value, safePascalIdentifier(fallback))
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}
