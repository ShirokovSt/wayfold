import type { Random } from './rng'

const GRID = 64 // the random values repeat after this many units

// Smooth random "heights" between 0 and 1: value noise, summed over three octaves,
// gives natural-looking coasts and patches
export function createNoise(random: Random): (x: number, y: number) => number {
  const values = Array.from({ length: GRID * GRID }, () => random())
  const value = (ix: number, iy: number) => values[wrap(iy) * GRID + wrap(ix)]

  const layer = (x: number, y: number) => {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = smooth(x - ix)
    const fy = smooth(y - iy)
    const top = value(ix, iy) + (value(ix + 1, iy) - value(ix, iy)) * fx
    const bottom = value(ix, iy + 1) + (value(ix + 1, iy + 1) - value(ix, iy + 1)) * fx
    return top + (bottom - top) * fy
  }
  return (x, y) => (layer(x, y) + 0.5 * layer(x * 2 + 17, y * 2 + 31) + 0.25 * layer(x * 4 + 53, y * 4 + 7)) / 1.75
}

function wrap(i: number): number {
  return ((i % GRID) + GRID) % GRID
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}
