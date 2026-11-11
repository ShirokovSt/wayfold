import { describe, expect, it } from 'vitest'
import { Rival } from '../ai/rival'
import { createRandom } from '../core/rng'
import { createWorld } from './mapgen'
import { Recording } from './replay'
import { TICK_SECONDS } from './rules'
import { tick } from './tick'
import { HUMAN, RIVAL, type World } from './world'

// What can be seen on the board: who holds what, how many people are where, the wolves and the gold
function picture(world: World) {
  return {
    villages: world.villages.map((village) => [village.owner, village.population, village.town]),
    squads: world.squads.map((squad) => [squad.id, squad.count, squad.x, squad.y]),
    owners: world.map.cells.map((cell) => [cell.owner, cell.building?.kind]),
    lairs: world.lairs.map((lair) => lair.pack),
    packs: world.packs.map((pack) => [pack.count, pack.x, pack.y]),
    gold: { ...world.gold },
    winner: world.winner,
  }
}

describe('a recording', () => {
  it('plays the match again the same way, from any moment', () => {
    const world = createWorld(5, { size: 'small', type: 'continent', beasts: 'many' })
    const players = [new Rival(HUMAN, createRandom(6), 'hard'), new Rival(RIVAL, createRandom(7), 'normal')]
    const recording = new Recording(world)
    const seen = new Map<number, ReturnType<typeof picture>>()
    while (world.winner === null && world.ticks < 6000) {
      for (const player of players) player.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
      recording.update()
      if (world.ticks % 777 === 0) seen.set(world.ticks, picture(world))
    }
    expect(world.orders.length).toBeGreaterThan(20)

    for (const [ticks, expected] of seen) expect(picture(recording.at(ticks))).toEqual(expected)
    const replay = recording.at(0)
    while (replay.ticks < recording.length) recording.step(replay)
    expect(picture(replay)).toEqual(picture(world))
  }, 30_000)
})
