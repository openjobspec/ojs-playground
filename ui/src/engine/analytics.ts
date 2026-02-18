type AnalyticsEvent =
  | 'playground_loaded'
  | 'simulation_run'
  | 'language_selected'
  | 'code_copied'
  | 'code_downloaded'
  | 'template_loaded'
  | 'tutorial_started'
  | 'tutorial_step_completed'
  | 'tutorial_completed'
  | 'backend_comparison_opened'
  | 'share_url_created'
  | 'share_url_opened'
  | 'local_mode_started'
  | 'conformance_test_run'

interface AnalyticsPayload {
  event: AnalyticsEvent
  properties?: Record<string, unknown>
  timestamp: number
}

// In-memory buffer for development; plug in real provider for production
const buffer: AnalyticsPayload[] = []
const MAX_BUFFER = 100

/**
 * Track an analytics event. No-op in dev unless a provider is configured.
 * Events are buffered in memory and can be flushed to any analytics provider.
 */
export function trackEvent(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  const payload: AnalyticsPayload = {
    event,
    properties,
    timestamp: Date.now(),
  }

  buffer.push(payload)
  if (buffer.length > MAX_BUFFER) {
    buffer.shift()
  }

  // Log in development
  if (import.meta.env.DEV) {
    console.debug('[analytics]', event, properties ?? '')
  }
}

/**
 * Get buffered events (for debugging or flush).
 */
export function getBufferedEvents(): readonly AnalyticsPayload[] {
  return buffer
}

/**
 * Clear the event buffer.
 */
export function clearBuffer(): void {
  buffer.length = 0
}

/**
 * Flush events to an analytics endpoint via sendBeacon.
 * No-op if no endpoint is configured.
 */
export function flushEvents(endpoint?: string): void {
  if (!endpoint || buffer.length === 0) return
  try {
    const data = JSON.stringify(buffer)
    navigator.sendBeacon(endpoint, data)
    buffer.length = 0
  } catch {
    // Silently fail — analytics should never break the app
  }
}

// Flush on page unload if an endpoint is configured
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const endpoint = (import.meta as unknown as { env?: { VITE_ANALYTICS_ENDPOINT?: string } }).env?.VITE_ANALYTICS_ENDPOINT
      if (endpoint) flushEvents(endpoint)
    }
  })
}
