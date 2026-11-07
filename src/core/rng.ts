export type Random = () => number

// Seeded random generator (mulberry32): the same seed gives the same map
export function createRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Whole number from min to max inclusive
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

export function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]
}
