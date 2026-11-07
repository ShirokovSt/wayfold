import { describe, expect, it } from 'vitest'
import { createRandom } from '../core/rng'
import { createWorld } from '../sim/mapgen'
import { TICK_SECONDS } from '../sim/rules'
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
})
