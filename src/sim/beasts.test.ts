import { describe, expect, it } from 'vitest'
import { hexDistance } from '../core/hex'
import { EventWatcher } from '../audio/events'
import { addLair, addVillage, handmadeWorld } from './handmade'
import { createWorld } from './mapgen'
import { findPath } from './pathfind'
import { LAIR_BOUNTY, LAIR_COUNT, LAIR_GAP, RAID_EVERY, TICK_SECONDS } from './rules'
import { sendSquad } from './squads'
import { tick } from './tick'
import { HUMAN, MAP_SIZES, RIVAL, SEASONS, type Season, type World } from './world'

const FIELD = ['............', '...........', '............', '...........', '............']

function run(world: World, seconds: number): void {
  for (let t = 0; t < seconds && world.winner === null; t += TICK_SECONDS) tick(world, TICK_SECONDS)
}

// Two players far apart, so the match does not end, and a den in the middle
function setUp(pack: number) {
  const world = handmadeWorld(FIELD)
  const home = addVillage(world, 0, 2, HUMAN, 40, true)
  addVillage(world, 11, 2, RIVAL, 10, true)
  const lair = addLair(world, 5, 2, pack)
  return { world, home, lair }
}

describe('wolves', () => {
  it.each(MAP_SIZES)('a %s map gets its dens in mirrored pairs, clear of the villages', (size) => {
    const world = createWorld(3, { size, type: 'continent', beasts: 'few' })
    expect(world.lairs.length).toBeGreaterThan(0)
    expect(world.lairs.length).toBeLessThanOrEqual(LAIR_COUNT[size].few)
    for (const lair of world.lairs) {
      expect(world.map.mirror(lair.cell).lair?.size).toBe(lair.size)
      for (const village of world.villages) {
        // Off the capitals' starting land always; closer to a neutral village only on a crowded map
        expect(hexDistance(lair.cell.hex, village.cell.hex)).toBeGreaterThanOrEqual(village.capital ? LAIR_GAP : LAIR_GAP - 2)
      }
    }
    for (const village of world.villages) expect(findPath(world.map, world.villages[0].cell, village.cell)).not.toBeNull()
    expect(world.map.cells.filter((cell) => cell.wild && cell.owner !== null)).toHaveLength(0)
    expect(createWorld(3, { size, type: 'continent', beasts: 'none' }).lairs).toHaveLength(0)
  })

  it('raid first sooner in a hungrier season', () => {
    const first = (season: Season) => createWorld(4, { size: 'small', type: 'continent', season, beasts: 'few' }).lairs[0].raidIn
    expect(first('winter')).toBeLessThan(first('summer'))
    for (const season of SEASONS) {
      expect(first(season)).toBeGreaterThanOrEqual(RAID_EVERY[season] * 0.67)
      expect(first(season)).toBeLessThanOrEqual(RAID_EVERY[season] * 1.33)
    }
  })

  it('find room even on crowded small maps', () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(createWorld(seed, { size: 'small', type: 'random', beasts: 'few' }).lairs.length).toBeGreaterThan(0)
    }
  }, 30_000)

  it('are walked around when there is room', () => {
    const { world, home } = setUp(10)
    const squad = sendSquad(world, HUMAN, home, world.map.cellAtOffset(9, 2)!)!
    expect(squad.path.some((cell) => cell.wild)).toBe(false)
  })

  it('bite squads in the wild land, which nobody can own', () => {
    const world = handmadeWorld(['............', '...........', '............'])
    const home = addVillage(world, 0, 1, HUMAN, 40, true)
    addVillage(world, 11, 0, RIVAL, 10, true)
    addLair(world, 5, 1, 10)
    const squad = sendSquad(world, HUMAN, home, world.map.cellAtOffset(9, 1)!)!
    run(world, 14)
    expect(squad.count).toBeLessThan(40)
    expect(world.map.cells.filter((cell) => cell.wild && cell.owner !== null)).toHaveLength(0)
    expect(world.map.cellAtOffset(9, 1)!.owner).toBe(HUMAN) // beyond it, land is painted as usual
  })

  it('give their land and a bounty to a squad that beats the pack', () => {
    const { world, home, lair } = setUp(10)
    const events = new EventWatcher()
    events.watch(world)
    const squad = sendSquad(world, HUMAN, home, lair.cell)!
    run(world, 6)
    expect(world.lairs).toHaveLength(0)
    expect(lair.cell.wild).toBe(false)
    expect(lair.cell.owner).toBe(HUMAN)
    expect(world.gold[HUMAN]).toBeGreaterThanOrEqual(LAIR_BOUNTY)
    expect(world.squads).toContain(squad) // the survivors walk home
    expect(events.watch(world)).toContain('capture')
  })

  it('beat a squad that is too small, and keep their den', () => {
    const { world, home, lair } = setUp(16)
    home.population = 12
    sendSquad(world, HUMAN, home, lair.cell)
    run(world, 8)
    expect(world.lairs).toContain(lair)
    expect(lair.pack).toBeLessThan(16)
    expect(world.squads).toHaveLength(0)
  })

  it('raid the nearest village now and then, and the survivors go home', () => {
    const { world, home, lair } = setUp(16)
    home.population = 4
    const events = new EventWatcher()
    events.watch(world)
    lair.raidIn = 0
    tick(world, TICK_SECONDS)
    expect(world.packs).toHaveLength(1)
    expect(events.watch(world)).toContain('howl')
    const pack = world.packs[0]
    run(world, 8)
    expect(home.population).toBeLessThan(4)
    expect(home.owner).toBe(HUMAN) // wolves only thin a village out
    expect(pack.returning || pack.count === 0).toBe(true)
  })
})
