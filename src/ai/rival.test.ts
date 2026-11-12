import { describe, expect, it } from 'vitest'
import { createRandom } from '../core/rng'
import { addVillage, handmadeWorld } from '../sim/handmade'
import { createWorld } from '../sim/mapgen'
import { TICK_SECONDS } from '../sim/rules'
import { sendSquad } from '../sim/squads'
import { tick } from '../sim/tick'
import { HUMAN, MAP_TYPES, RIVAL } from '../sim/world'
import { Rival } from './rival'

describe('rival AI', () => {
  it('waits a little, then starts expanding', () => {
    const world = createWorld(5)
    const rival = new Rival(RIVAL, createRandom(1))
    const play = (seconds: number) => {
      for (let t = 0; t < seconds; t += TICK_SECONDS) {
        rival.update(world, TICK_SECONDS)
        tick(world, TICK_SECONDS)
      }
    }
    play(9)
    expect(world.squads).toHaveLength(0)
    play(40)
    expect(world.villages.filter((v) => v.owner === RIVAL).length).toBeGreaterThan(1)
  })

  // A whole match takes a few seconds to simulate, hence the longer time limit
  it.each(MAP_TYPES)('two AIs play a whole match to the end (%s)', (type) => {
    const world = createWorld(1, { size: 'medium', type })
    const players = [new Rival(HUMAN, createRandom(11)), new Rival(RIVAL, createRandom(21))]
    while (world.winner === null && world.time < 20 * 60) {
      for (const player of players) player.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
    }
    // Not an assertion on balance, just that the rules keep working for a full match
    expect(world.time).toBeGreaterThan(10)
  }, 30_000)

  // The trick of sending a squad at a village and taking it once the rival has sent everyone away
  it.each([
    ['normal', true],
    ['easy', false],
  ] as const)('a %s rival keeps a garrison against a squad heading its way: %s', (difficulty, keeps) => {
    const world = handmadeWorld(['..........', '.........', '..........'])
    const home = addVillage(world, 0, 1, HUMAN, 20, true)
    const village = addVillage(world, 7, 1, RIVAL, 24, true)
    addVillage(world, 9, 0, null, 3)
    sendSquad(world, HUMAN, home, village.cell, 'half')
    new Rival(RIVAL, createRandom(1), difficulty).update(world, 30)
    expect(world.squads.some((squad) => squad.owner === RIVAL)).toBe(true) // it still went for the neutral village
    expect(village.population >= 11).toBe(keeps) // ten people are coming: enough stayed home
  })

  it.each([HUMAN, RIVAL])('a hard rival beats an easy one (hard plays %i)', (hard) => {
    const world = createWorld(2, { size: 'medium', type: 'continent' })
    const players = world.players.map((player) => new Rival(player, createRandom(player + 5), player === hard ? 'hard' : 'easy'))
    while (world.winner === null && world.time < 20 * 60) {
      for (const player of players) player.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
    }
    expect(world.winner).toBe(hard)
  }, 30_000)
})
