import { describe, expect, it } from 'vitest'
import { Rival } from '../ai/rival'
import { hexDistance } from '../core/hex'
import { createRandom } from '../core/rng'
import { addVillage, handmadeWorld } from './handmade'
import { createWorld } from './mapgen'
import { findPath } from './pathfind'
import { TICK_SECONDS } from './rules'
import { standings, tick } from './tick'
import { HUMAN, MAP_TYPES, type MapSize, RIVAL } from './world'

describe('several players', () => {
  it.each([
    ['medium', 3],
    ['large', 3],
    ['large', 4],
  ] as [MapSize, number][])('a %s map for %i players gives everyone a fair start', (size, players) => {
    for (const type of MAP_TYPES) {
      for (const seed of [1, 2, 3]) {
        const world = createWorld(seed, { size, type, players, beasts: 'few' })
        const capitals = world.villages.filter((village) => village.capital)
        expect(world.players).toHaveLength(players)
        expect(new Set(capitals.map((capital) => capital.owner)).size).toBe(players)
        for (const village of world.villages) expect(findPath(world.map, capitals[0].cell, village.cell)).not.toBeNull()

        // Each capital is closest to about as many neutral villages as the others
        const shares = capitals.map(() => 0)
        for (const village of world.villages.filter((v) => v.owner === null)) {
          const distances = capitals.map((capital) => hexDistance(capital.cell.hex, village.cell.hex))
          const nearest = distances.flatMap((d, i) => (d === Math.min(...distances) ? [i] : []))
          for (const i of nearest) shares[i] += 1 / nearest.length
        }
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('a match of two keeps the same maps as before', () => {
    const world = createWorld(7, { size: 'medium', type: 'continent' })
    expect(world.villages[0].owner).toBe(HUMAN) // you start on the left
    expect(world.map.mirror(world.villages[0].cell)).toBe(world.villages[1].cell)
  })

  it('go out one by one; you win when you are the last one standing', () => {
    const world = handmadeWorld(['..........', '.........', '..........'])
    world.players = [0, 1, 2]
    addVillage(world, 0, 1, HUMAN, 10, true)
    const red = addVillage(world, 9, 0, RIVAL, 10, true)
    const third = addVillage(world, 9, 2, 2, 10, true)
    third.owner = null
    tick(world, TICK_SECONDS)
    expect(world.out.map((out) => out.player)).toEqual([2])
    expect(world.winner).toBeNull()
    red.owner = null
    tick(world, TICK_SECONDS)
    expect(world.winner).toBe(HUMAN)
    expect(standings(world)).toEqual([HUMAN, RIVAL, 2])
  })

  it('end the match for you when you fall, with the strongest rival ahead', () => {
    const world = handmadeWorld(['..........', '.........', '..........'])
    world.players = [0, 1, 2]
    const home = addVillage(world, 0, 1, HUMAN, 10, true)
    addVillage(world, 9, 0, RIVAL, 10, true)
    addVillage(world, 9, 2, 2, 10, true)
    addVillage(world, 5, 2, 2, 10)
    home.owner = 2
    tick(world, TICK_SECONDS)
    expect(world.winner).toBe(2)
    expect(standings(world)).toEqual([2, RIVAL, HUMAN])
  })

  it('four AIs play a large map to the end', () => {
    const world = createWorld(3, { size: 'large', type: 'continent', players: 4, beasts: 'few' })
    const rivals = world.players.map((player) => new Rival(player, createRandom(player + 40), 'hard'))
    // The match stops for player 0 once they fall, as it would for you
    while (world.winner === null && world.time < 25 * 60) {
      for (const rival of rivals) rival.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
    }
    // Not an assertion on balance, just that the rules keep working with everyone against everyone
    expect(world.out.length).toBeGreaterThan(0)
  }, 60_000)
})
