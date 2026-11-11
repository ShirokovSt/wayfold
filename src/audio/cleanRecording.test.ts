import { describe, expect, it } from 'vitest'
import { cleanRecording } from './cleanRecording'

const RATE = 44100

function level(samples: Float32Array): number {
  return Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length)
}

describe('cleaning a recording', () => {
  it('drops the lead-in and takes the hiss out of the quiet part', () => {
    // Half a second of hiss, a second of a tone over the hiss, another second of hiss
    let seed = 1
    const hiss = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5) * 0.02
    const input = Float32Array.from({ length: RATE * 2.5 }, (_, i) => {
      const t = i / RATE
      return hiss() + (t >= 0.5 && t < 1.5 ? 0.5 * Math.sin(2 * Math.PI * 440 * t) : 0)
    })
    const clean = cleanRecording(input, RATE, { noise: 0.5, lowCut: 100, highCut: 5000, fadeOut: 0.1 })
    expect(clean.length).toBe(RATE * 2)
    const tone = level(clean.slice(RATE * 0.2, RATE * 0.8))
    const quiet = level(clean.slice(RATE * 1.3, RATE * 1.8))
    const before = level(input.slice(RATE * 1.8, RATE * 2.3)) / level(input.slice(RATE * 0.7, RATE * 1.3))
    expect(quiet / tone).toBeLessThan(before / 10) // the hiss is at least 20 dB quieter next to the tone
  })
})
