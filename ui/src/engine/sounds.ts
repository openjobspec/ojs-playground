/**
 * Minimal Web Audio API sound effects for simulation playback.
 * All sounds are synthesized — no audio files required.
 */

let audioCtx: AudioContext | null = null

function getContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext()
    }
    return audioCtx
  } catch {
    return null
  }
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gain = 0.08) {
  const ctx = getContext()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const vol = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime)
  vol.gain.setValueAtTime(gain, ctx.currentTime)
  vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(vol)
  vol.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

export function playTransitionSound() {
  playTone(600, 0.08, 'sine', 0.05)
}

export function playSuccessSound() {
  playTone(523, 0.1, 'sine', 0.06)
  setTimeout(() => playTone(659, 0.1, 'sine', 0.06), 80)
  setTimeout(() => playTone(784, 0.15, 'sine', 0.06), 160)
}

export function playFailureSound() {
  playTone(200, 0.15, 'square', 0.04)
  setTimeout(() => playTone(150, 0.2, 'square', 0.04), 120)
}

export function playRetrySound() {
  playTone(440, 0.06, 'triangle', 0.05)
}
