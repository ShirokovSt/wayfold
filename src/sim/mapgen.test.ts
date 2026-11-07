import { describe, expect, it } from 'vitest'
import { hexToPoint } from '../core/hex'
import { createWorld } from './mapgen'
import { findPath } from './pathfind'
import { NEUTRAL_PAIRS } from './rules'
import { HUMAN, RIVAL } from './world'

describe('map generator', () => {
  const seeds = [1, 2, 3, 42, 2026, 777777]

  it('gives the same map for the same seed', () => {
    const terrain = (seed: number) => createWorld(seed).map.cells.map((cell) => cell.terrain).join()
    expect(terrain(42)).toBe(terrain(42))
    expect(terrain(42)).not.toBe(terrain(43))
  })

  it('mirror is a 180° turn around the map center', () => {
    const { map } = createWorld(1)
    const sum = (index: number) => {
      const a = hexToPoint(map.cells[index].hex, 1)
      const b = hexToPoint(map.mirror(map.cells[index]).hex, 1)
      return [a.x + b.x, a.y + b.y]
    }
    for (const index of [0, 17, 50, 120]) {
      expect(sum(index)[0]).toBeCloseTo(sum(0)[0])
      expect(sum(index)[1]).toBeCloseTo(sum(0)[1])
    }
  })

  it.each(seeds)('makes a fair, playable map (seed %i)', (seed) => {
    const world = createWorld(seed)
    const { map, villages } = world
    for (const cell of map.cells) expect(map.mirror(cell).terrain).toBe(cell.terrain)

    expect(villages).toHaveLength(2 + 2 * NEUTRAL_PAIRS)
    expect(villages[0].owner).toBe(HUMAN)
    expect(villages[1].owner).toBe(RIVAL)
    expect(villages[1].cell).toBe(map.mirror(villages[0].cell))

    for (const village of villages.slice(1)) {
      expect(findPath(map, villages[0].cell, village.cell)).not.toBeNull()
    }
    // The river is between the capitals: the way across goes through a ford
    const path = findPath(map, villages[0].cell, villages[1].cell)!
    expect(path.some((cell) => cell.terrain === 'ford')).toBe(true)
  })
})
