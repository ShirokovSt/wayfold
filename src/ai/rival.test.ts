import { describe, expect, it } from 'vitest'
import { createRandom } from '../core/rng'
import { createWorld } from '../sim/mapgen'
import { TICK_SECONDS } from '../sim/rules'
import { tick } from '../sim/tick'
import { HUMAN, RIVAL } from '../sim/world'
import { Rival } from './rival'

describe('rival AI', () => {
  it('starts expanding within the first seconds', () => {
    const world = createWorld(5)
    const rival = new Rival(RIVAL, createRandom(1))
    for (let t = 0; t < 20; t += TICK_SECONDS) {
      rival.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
    }
    expect(world.villages.filter((v) => v.owner === RIVAL).length).toBeGreaterThan(1)
  })

  it.each([1, 2, 3])('two AIs play a whole match to the end (seed %i)', (seed) => {
    const world = createWorld(seed)
    const players = [new Rival(HUMAN, createRandom(seed + 10)), new Rival(RIVAL, createRandom(seed + 20))]
    while (world.winner === null && world.time < 20 * 60) {
      for (const player of players) player.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
    }
    // Not an assertion on balance, just that the rules keep working for a full match
    expect(world.time).toBeGreaterThan(10)
  })
})
