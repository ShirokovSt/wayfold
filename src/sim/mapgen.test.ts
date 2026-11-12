import { describe, expect, it } from 'vitest'
import { hexToPoint } from '../core/hex'
import { createWorld } from './mapgen'
import { findPath } from './pathfind'
import { VILLAGE_PAIRS } from './rules'
import { HUMAN, MAP_SIZES, MAP_TYPES, RIVAL } from './world'

describe('map generator', () => {
  it('gives the same map for the same seed and settings', () => {
    const terrain = (seed: number) =>
      createWorld(seed, { size: 'medium', type: 'random' }).map.cells.map((cell) => cell.terrain).join()
    expect(terrain(42)).toBe(terrain(42))
    expect(terrain(42)).not.toBe(terrain(43))
  })

  it('mirror is a 180° turn around the map center', () => {
    const { map } = createWorld(1, { size: 'large', type: 'islands' })
    const sum = (index: number) => {
      const a = hexToPoint(map.cells[index].hex, 1)
      const b = hexToPoint(map.mirror(map.cells[index]).hex, 1)
      return [a.x + b.x, a.y + b.y]
    }
    for (const index of [0, 17, 50, 120, 300]) {
      expect(sum(index)[0]).toBeCloseTo(sum(0)[0])
      expect(sum(index)[1]).toBeCloseTo(sum(0)[1])
    }
  })

  const cases = MAP_TYPES.flatMap((type) => MAP_SIZES.map((size) => ({ type, size })))
  it.each(cases)('makes a fair, playable $type map ($size)', ({ type, size }) => {
    for (const seed of [1, 2, 3]) {
      const world = createWorld(seed, { size, type })
      const { map, villages } = world
      expect(world.mapType).toBe(type)
      for (const cell of map.cells) expect(map.mirror(cell).terrain).toBe(cell.terrain)

      expect(villages.length).toBeGreaterThanOrEqual(2 * VILLAGE_PAIRS.min)
      expect(villages.length).toBeLessThanOrEqual(2 * VILLAGE_PAIRS.max)
      expect(villages[0].owner).toBe(HUMAN)
      expect(villages[1].owner).toBe(RIVAL)
      expect(villages[1].cell).toBe(map.mirror(villages[0].cell))
      for (const village of villages.slice(1)) {
        expect(findPath(map, villages[0].cell, village.cell)).not.toBeNull()
      }
    }
  })

  it('has water to deal with on every map type but the mainland', () => {
    const water = (type: (typeof MAP_TYPES)[number]) =>
      createWorld(7, { size: 'medium', type }).map.cells.filter((c) => c.terrain === 'water').length
    expect(water('islands')).toBeGreaterThan(water('continent'))
    expect(water('peninsulas')).toBeGreaterThan(water('continent'))
  })

  it('parts the islands by sea, with fords across, for any number of players', () => {
    for (const [size, players] of [['small', 2], ['medium', 3], ['large', 4]] as const) {
      for (const seed of [1, 2, 3]) {
        const { map, villages } = createWorld(seed, { size, type: 'islands', players })
        expect(map.cells.some((cell) => cell.terrain === 'ford')).toBe(true)
        // Without the fords, no capital can walk to another
        for (const cell of map.cells) if (cell.terrain === 'ford') cell.terrain = 'water'
        expect(findPath(map, villages[0].cell, villages[1].cell)).toBeNull()
      }
    }
  })

  it('has lakes inland on a map of lakes, more than the mainland has', () => {
    // Water that does not reach the map edge, as in winter, when it freezes
    const inland = (type: (typeof MAP_TYPES)[number], seed: number) =>
      createWorld(seed, { size: 'medium', type, season: 'winter' }).map.cells.filter((c) => c.terrain === 'ice').length
    for (const seed of [1, 2, 3]) expect(inland('lakes', seed)).toBeGreaterThan(inland('continent', seed) + 10)
  })

  it('on the mainland, the way between capitals crosses the river at a ford', () => {
    const { map, villages } = createWorld(3, { size: 'small', type: 'continent' })
    const path = findPath(map, villages[0].cell, villages[1].cell)!
    expect(path.some((cell) => cell.terrain === 'ford')).toBe(true)
  })
})
