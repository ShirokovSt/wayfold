import type { Season } from '../sim/world'
import type { DrumStroke } from './instruments'

export type Theme = Season | 'menu'

// Who carries the tune: the recorder, the lute an octave lower, or the lute with a quiet recorder above it
export type Lead = 'flute' | 'lute' | 'both'

// Bars as `note:length | note:length …`, lengths in units; one root per bar for the lute's open fifths
export interface Part {
  bars: string
  roots: string
}

export interface Tune {
  unit: number // seconds
  beats: number // units in a bar
  flute: number // the recorder's volume
  hall: number // how much of the stone hall's echo
  accompaniment: [at: number, interval: number, volume: number][] // lute strokes in every bar, as multiples of the root
  drums: [at: number, stroke: DrumStroke, volume: number][]
  bells?: { every: number; notes: string[]; volume: number } // a bell every few bars, the notes taking turns
  intro: 'drums' | 'lute' | 'none' // two bars before the tune
  sections: [Part, Lead][]
}

const ESTAMPIE_A: Part = {
  bars: `D5:2 E5:1 F5:2 G5:1 | A5:3 G5:2 F5:1 | E5:2 F5:1 G5:2 E5:1 | D5:3 A4:3 |
    D5:2 E5:1 F5:2 G5:1 | A5:2 C6:1 B5:2 A5:1 | G5:2 F5:1 E5:2 C5:1 | D5:6`,
  roots: 'D3 D3 C3 D3 D3 A2 C3 D3',
}
const ESTAMPIE_B: Part = {
  bars: `A5:2 A5:1 C6:2 A5:1 | G5:2 F5:1 G5:3 | F5:2 E5:1 F5:2 G5:1 | A5:6 |
    C6:2 B5:1 A5:2 G5:1 | F5:2 G5:1 A5:2 F5:1 | E5:2 D5:1 E5:2 C5:1 | D5:6`,
  roots: 'A2 C3 F2 A2 C3 F2 C3 D3',
}

const CANTIGA_A: Part = {
  bars: `A4:2 C5:1 | D5:2 E5:1 | E5:1 D5:1 C5:1 | B4:2 A4:1 |
    G4:2 A4:1 | B4:1 C5:1 D5:1 | C5:1 B4:1 G4:1 | A4:3`,
  roots: 'A2 D3 A2 E3 G2 G2 C3 A2',
}
const CANTIGA_B: Part = {
  bars: `E5:2 E5:1 | F#5:1 G5:1 E5:1 | D5:2 C5:1 | B4:3 |
    C5:1 D5:1 E5:1 | D5:1 C5:1 B4:1 | G4:1 A4:1 B4:1 | A4:3`,
  roots: 'A2 E3 D3 E3 C3 G2 G2 A2',
}

const AIR_A: Part = {
  bars: `E5:2 D5:1 | B4:3 | C5:1 D5:1 E5:1 | B4:3 |
    A4:2 B4:1 | G4:1 F#4:1 G4:1 | A4:2 F#4:1 | E4:3`,
  roots: 'E3 G2 A2 E3 A2 G2 D3 E3',
}
const AIR_B: Part = {
  bars: `G4:1 A4:1 B4:1 | E5:3 | D5:1 C5:1 D5:1 | B4:3 |
    C5:2 B4:1 | A4:1 G4:1 A4:1 | B4:2 F#4:1 | E4:3`,
  roots: 'E3 E3 D3 G2 A2 D3 B2 E3',
}

const SALTARELLO_A: Part = {
  bars: `G5:1 G5:1 A5:1 B5:1 | C6:2 B5:1 A5:1 | G5:1 A5:1 B5:1 G5:1 | D5:2 D5:2 |
    G5:1 G5:1 A5:1 B5:1 | C6:1 D6:1 C6:1 B5:1 | A5:1 F5:1 G5:1 A5:1 | G5:4`,
  roots: 'G2 C3 G2 D3 G2 C3 F2 G2',
}
const SALTARELLO_B: Part = {
  bars: `D6:2 C6:1 B5:1 | C6:2 B5:1 A5:1 | B5:1 A5:1 G5:1 F5:1 | G5:2 D5:2 |
    E5:1 F5:1 G5:1 A5:1 | B5:1 C6:1 D6:2 | C6:1 B5:1 A5:1 F5:1 | G5:4`,
  roots: 'D3 C3 G2 G2 C3 G2 F2 G2',
}

const PRELUDE_A: Part = {
  bars: `D5:2 E5:1 | F5:2 G5:1 | A5:3 | G5:1 F5:1 E5:1 |
    F5:2 D5:1 | E5:2 C5:1 | D5:3 | A4:3`,
  roots: 'D3 F2 A2 C3 D3 C3 D3 A2',
}
const PRELUDE_B: Part = {
  bars: `C5:2 D5:1 | E5:2 F5:1 | G5:2 A5:1 | E5:3 |
    F5:1 G5:1 A5:1 | G5:1 F5:1 E5:1 | C5:2 E5:1 | D5:3`,
  roots: 'C3 C3 G2 A2 F2 C3 C3 D3',
}

export const TUNES: Record<Theme, Tune> = {
  // An estampie in D Dorian, a lively dance in 6/8
  summer: {
    unit: 0.21, beats: 6, flute: 0.32, hall: 0.35, intro: 'drums',
    accompaniment: [[0, 1, 0.3], [0, 1.5, 0.18], [3, 2, 0.15], [4, 1.5, 0.12]],
    drums: [[0, 'boom', 0.5], [3, 'tap', 0.28], [5, 'jingle', 0.06]],
    sections: [[ESTAMPIE_A, 'flute'], [ESTAMPIE_B, 'flute'], [ESTAMPIE_A, 'lute'], [ESTAMPIE_B, 'flute']],
  },
  // A cantiga in A Dorian, unhurried, a slow drum like steps on fallen leaves
  autumn: {
    unit: 0.5, beats: 3, flute: 0.3, hall: 0.45, intro: 'drums',
    accompaniment: [[0, 1, 0.3], [1, 1.5, 0.16], [2, 2, 0.14]],
    drums: [[0, 'boom', 0.3], [2, 'tap', 0.12]],
    sections: [[CANTIGA_A, 'flute'], [CANTIGA_B, 'flute'], [CANTIGA_A, 'lute'], [CANTIGA_B, 'flute']],
  },
  // A slow air in E minor: a low recorder, a sparse lute and bells through the cold
  winter: {
    unit: 0.62, beats: 3, flute: 0.28, hall: 0.55, intro: 'none',
    accompaniment: [[0, 1, 0.26], [1.5, 1.5, 0.12]],
    drums: [],
    bells: { every: 2, notes: ['B5', 'E6'], volume: 0.07 },
    sections: [[AIR_A, 'flute'], [AIR_B, 'flute'], [AIR_A, 'lute'], [AIR_B, 'flute']],
  },
  // A saltarello in G Mixolydian, quick and merry
  spring: {
    unit: 0.18, beats: 4, flute: 0.32, hall: 0.3, intro: 'drums',
    accompaniment: [[0, 1, 0.28], [2, 1.5, 0.16], [3, 2, 0.1]],
    drums: [[0, 'boom', 0.45], [1, 'jingle', 0.05], [2, 'tap', 0.3], [3, 'jingle', 0.06]],
    sections: [
      [SALTARELLO_A, 'flute'], [SALTARELLO_B, 'flute'],
      [SALTARELLO_A, 'both'], [SALTARELLO_B, 'both'],
      [SALTARELLO_A, 'flute'], [SALTARELLO_B, 'flute'],
    ],
  },
  // A slow prelude on the opening of the summer estampie
  menu: {
    unit: 0.6, beats: 3, flute: 0.28, hall: 0.5, intro: 'lute',
    accompaniment: [[0, 1, 0.26], [1, 1.5, 0.13], [2, 2, 0.12]],
    drums: [],
    bells: { every: 4, notes: ['D6', 'A5'], volume: 0.035 },
    sections: [[PRELUDE_A, 'flute'], [PRELUDE_B, 'flute'], [PRELUDE_A, 'lute'], [PRELUDE_B, 'flute']],
  },
}

export interface Note {
  pitch: number // Hz
  units: number
}

export interface Bar {
  notes: Note[]
  root: number
}

export function parsePart(part: Part): Bar[] {
  const roots = part.roots.trim().split(/\s+/)
  return part.bars.split('|').map((bar, i) => ({
    notes: bar.trim().split(/\s+/).map((token) => {
      const [note, units] = token.split(':')
      return { pitch: pitchOf(note), units: Number(units) }
    }),
    root: pitchOf(roots[i]),
  }))
}

const STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// 'A4' is 440 Hz; a # raises a note by a semitone
export function pitchOf(note: string): number {
  const match = /^([A-G])(#?)(\d)$/.exec(note)
  if (!match) throw new Error(`Not a note: ${note}`)
  const midi = 12 * (Number(match[3]) + 1) + STEPS[match[1]] + (match[2] ? 1 : 0)
  return 440 * 2 ** ((midi - 69) / 12)
}
