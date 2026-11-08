import { describe, expect, it } from 'vitest'
import { collectGold } from './economy'
import { addVillage, handmadeWorld } from './handmade'
import { createWorld } from './mapgen'
import { findPath, pathDuration } from './pathfind'
import { GOLD_PER_TILE, HARVEST_GOLD } from './rules'
import { paint } from './territory'
import { growthRate } from './villages'
import { HUMAN, RIVAL, type Season, type World } from './world'

function smallWorld(season: Season): World {
  const world = handmadeWorld(['.f.....', '......', '.......'])
  world.map.season = season
  addVillage(world, 0, 0, HUMAN, 10)
  addVillage(world, 6, 2, RIVAL, 10)
  return world
}

describe('seasons', () => {
  it('keep the same map and villages for the same seed', () => {
    const land = (season: Season) => {
      const world = createWorld(7, { size: 'medium', type: 'lakes', season })
      return world.map.cells.map((cell) => (cell.terrain === 'ice' ? 'water' : cell.terrain) + (cell.village ? 'v' : '')).join()
    }
    expect(land('winter')).toBe(land('summer'))
  })

  it('freeze rivers and lakes in winter, but not the sea', () => {
    const { map } = createWorld(3, { size: 'medium', type: 'continent', season: 'winter' })
    expect(map.cells.some((cell) => cell.terrain === 'ice')).toBe(true)
    const edge = map.cells.filter((cell) => map.neighbors(cell).length < 6)
    expect(edge.some((cell) => cell.terrain === 'water')).toBe(true)
    expect(createWorld(3, { size: 'medium', type: 'continent', season: 'summer' }).map.cells.some((c) => c.terrain === 'ice')).toBe(false)
  })

  it('let squads walk on ice, but nobody owns it', () => {
    const world = handmadeWorld(['..w....', '......', '.......'])
    const ice = world.map.cellAtOffset(2, 0)!
    ice.terrain = 'ice'
    paint(ice, HUMAN)
    expect(ice.owner).toBeNull()
    expect(findPath(world.map, world.map.cellAtOffset(1, 0)!, world.map.cellAtOffset(3, 0)!)).toHaveLength(3)
  })

  it('slow squads down in autumn mud and winter snow', () => {
    const time = (season: Season) => {
      const world = smallWorld(season)
      const path = findPath(world.map, world.villages[0].cell, world.map.cellAtOffset(5, 0)!)!
      return pathDuration(world.map, path)
    }
    expect(time('autumn')).toBeGreaterThan(time('summer'))
    expect(time('winter')).toBeGreaterThan(time('autumn'))
  })

  it('make villages grow slower in winter and faster in spring', () => {
    const rate = (season: Season) => {
      const world = smallWorld(season)
      return growthRate(world, world.villages[0])
    }
    expect(rate('winter')).toBeLessThan(rate('summer'))
    expect(rate('spring')).toBeGreaterThan(rate('summer'))
  })

  it('bring a harvest of gold from every farm in autumn', () => {
    const gold = (season: Season) => {
      const world = smallWorld(season)
      world.map.cellAtOffset(1, 1)!.owner = HUMAN
      world.map.cellAtOffset(1, 1)!.building = { kind: 'farm', reload: 0 }
      collectGold(world, 1)
      return world.gold[HUMAN]
    }
    expect(gold('summer')).toBeCloseTo(2 * GOLD_PER_TILE)
    expect(gold('autumn')).toBeCloseTo(2 * GOLD_PER_TILE + HARVEST_GOLD)
  })
})
