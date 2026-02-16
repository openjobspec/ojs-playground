/**
 * Lightweight i18n infrastructure for the OJS Playground.
 *
 * V1 ships English-only. This module provides the extensibility point
 * for future localization without code changes — just add new locale
 * files and update the supported locales list.
 *
 * Usage:
 *   import { t } from '@/i18n'
 *   <span>{t('editor.title')}</span>
 */

export type Locale = 'en'

const messages: Record<Locale, Record<string, string>> = {
  en: {
    // Shell
    'app.title': 'Playground',
    'app.mode.browser': 'Browser Mode',
    'app.mode.local': 'Local Mode',
    'app.share': 'Copy share URL',

    // Tabs
    'tab.code': 'Code',
    'tab.templates': 'Templates',
    'tab.backends': 'Backends',
    'tab.levels': 'Levels',
    'tab.tutorials': 'Tutorials',
    'tab.workers': 'Workers',
    'tab.chaos': 'Chaos',
    'tab.jobs': 'Jobs',
    'tab.tests': 'Tests',

    // Editor
    'editor.title': 'Editor',
    'editor.json': 'JSON',
    'editor.yaml': 'YAML',

    // Visualization
    'viz.title': 'Visualization',
    'viz.lifecycle': 'Lifecycle',
    'viz.dag': 'Workflow DAG',
    'viz.timeline': 'Timeline',
    'viz.retryParams': 'Retry Params',

    // Code generation
    'codegen.title': 'Code',
    'codegen.enqueue': 'Enqueue',
    'codegen.worker': 'Worker',
    'codegen.full': 'Full',
    'codegen.copy': 'Copy',
    'codegen.download': 'Download',

    // Simulation
    'sim.play': 'Play',
    'sim.pause': 'Pause',
    'sim.step': 'Step',
    'sim.reset': 'Reset',
    'sim.baseline': 'Baseline',
    'sim.clear': 'Clear',

    // Backend comparison
    'comparison.title': 'Backend Comparison',
    'comparison.export': 'Export as Markdown',
    'comparison.recommended': 'Recommended',

    // Conformance
    'conformance.title': 'Conformance Levels',
    'conformance.yourSpec': 'Your spec',

    // Local Mode
    'local.requiresLocal': 'requires Local Mode',
    'local.runCommand': 'Run npx ojs-playground dev to enable',

    // Chaos
    'chaos.title': 'Chaos',
    'chaos.active': 'Chaos is active — jobs may fail or experience delays',
    'chaos.failNext': 'Fail Next N Executions',
    'chaos.latency': 'Added Latency',
    'chaos.timeout': 'Timeout Next Execution',
    'chaos.networkPartition': 'Simulate Network Partition',
    'chaos.reset': 'Reset',

    // Workers
    'workers.title': 'Workers',
    'workers.none': 'No workers discovered yet',
    'workers.drain': 'Drain worker (stop accepting new jobs)',
    'workers.remove': 'Remove worker',

    // Jobs
    'jobs.title': 'Recent Jobs',
    'jobs.none': 'No jobs yet — enqueue one to see it here',
  },
}

let currentLocale: Locale = 'en'

/**
 * Get a translated string by key. Returns the key itself if not found.
 */
export function t(key: string): string {
  return messages[currentLocale]?.[key] ?? key
}

/**
 * Set the active locale.
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale
}

/**
 * Get the current locale.
 */
export function getLocale(): Locale {
  return currentLocale
}

/**
 * Get all supported locales.
 */
export function getSupportedLocales(): Locale[] {
  return Object.keys(messages) as Locale[]
}
