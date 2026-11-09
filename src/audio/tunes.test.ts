import { describe, expect, it } from 'vitest'
import { TUNES, parsePart, pitchOf } from './tunes'

describe('tunes', () => {
  it('reads notes as pitches', () => {
    expect(pitchOf('A4')).toBeCloseTo(440)
    expect(pitchOf('A5')).toBeCloseTo(880)
    expect(pitchOf('F#5') / pitchOf('F5')).toBeCloseTo(2 ** (1 / 12))
    expect(() => pitchOf('H2')).toThrow()
  })

  // A bar one unit too long or short would put the tune out of step with the drums
  for (const [theme, tune] of Object.entries(TUNES)) {
    it(`${theme}: every bar is full and has its root`, () => {
      for (const [part] of tune.sections) {
        const bars = parsePart(part)
        expect(bars).toHaveLength(part.roots.trim().split(/\s+/).length)
        for (const bar of bars) {
          expect(bar.notes.reduce((sum, note) => sum + note.units, 0)).toBe(tune.beats)
          expect(Number.isFinite(bar.root)).toBe(true)
        }
      }
    })
  }
})
