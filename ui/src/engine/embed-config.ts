import type { CodegenLanguage } from './types'
import type { Theme } from '@/store/slices/ui'

const THEMES = new Set<Theme>(['light', 'dark', 'system'])
const LANGUAGES = new Set<CodegenLanguage>(['go', 'javascript', 'python', 'ruby', 'rust', 'java'])

export interface EmbedOptions {
  enabled: boolean
  theme?: Theme
  language?: CodegenLanguage
  spec?: string
  readonly: boolean
}

export function getEmbedOptions(search = window.location.search): EmbedOptions {
  const params = new URLSearchParams(search)
  const embed = params.get('embed')
  const theme = params.get('theme')
  const language = params.get('language')
  const spec = params.get('spec')

  return {
    enabled: embed === 'true' || embed === '1',
    ...(theme && THEMES.has(theme as Theme) ? { theme: theme as Theme } : {}),
    ...(language && LANGUAGES.has(language as CodegenLanguage)
      ? { language: language as CodegenLanguage }
      : {}),
    ...(spec ? { spec: decodeEmbeddedSpec(spec) } : {}),
    readonly: params.get('readonly') === '1' || params.get('readonly') === 'true',
  }
}

export function normalizeEmbedDimension(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  const match = /^(\d{1,4}(?:\.\d{1,2})?)(px|%|rem|em|vh|vw)?$/.exec(value.trim())
  if (!match) return fallback
  const amount = Number(match[1])
  const unit = match[2] ?? 'px'
  const maximum = unit === 'px' ? 4000 : unit === 'rem' || unit === 'em' ? 200 : 100
  if (!Number.isFinite(amount) || amount <= 0 || amount > maximum) return fallback
  return `${amount}${unit}`
}

export function escapeHTMLAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function decodeEmbeddedSpec(spec: string): string {
  const trimmed = spec.trimStart().toLowerCase()
  if (!trimmed.startsWith('%7b') && !trimmed.startsWith('%5b')) return spec
  try {
    return decodeURIComponent(spec)
  } catch {
    return spec
  }
}
