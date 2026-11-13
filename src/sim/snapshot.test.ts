import { describe, expect, it } from 'vitest'
import { Rival } from '../ai/rival'
import { createRandom } from '../core/rng'
import { fromBytes, newReplay, toBytes } from '../replays/format'
import { createWorld } from './mapgen'
import { Recording } from './replay'
import { TICK_SECONDS } from './rules'
import { decodeStart, encodeStart, fingerprint } from './snapshot'
import { tick } from './tick'
import type { World } from './world'

function playMatch(world: World, ticks: number): Recording {
  const recording = Recording.of(world)
  const rivals = world.players.map((player, i) => new Rival(player, createRandom(40 + i), 'hard'))
  while (world.winner === null && world.ticks < ticks) {
    for (const rival of rivals) rival.update(world, TICK_SECONDS)
    tick(world, TICK_SECONDS)
    recording.note(world)
  }
  return recording
}

describe('a saved match', () => {
  it('keeps the start of the match as it was', () => {
    const world = createWorld(9, { size: 'small', type: 'lakes', beasts: 'many', season: 'winter', players: 3 })
    const start = JSON.parse(JSON.stringify(encodeStart(world)))
    expect(decodeStart(start)).toEqual(world)
  })

  it('played again from its packed start and orders, comes to the same end', async () => {
    const world = createWorld(12, { size: 'medium', type: 'islands', beasts: 'many', players: 4 })
    const recording = playMatch(world, 3000)
    expect(world.orders.length).toBeGreaterThan(20)
    const info = {
      savedAt: 1, ticks: world.ticks, mapType: world.mapType, size: 'medium', season: world.map.season, players: 4,
      difficulty: 'hard', beasts: 'many', place: 1, end: fingerprint(world),
    } as const
    const replay = await fromBytes(await toBytes(newReplay(info, encodeStart(recording.start), world.orders)))

    const again = new Recording(decodeStart(replay.start), replay.orders, () => replay.info.ticks)
    expect(fingerprint(again.at(replay.info.ticks))).toBe(replay.info.end)
    expect(fingerprint(again.at(1234))).toBe(fingerprint(recording.at(1234)))
  }, 30_000)

  it('is not read from a file of something else', async () => {
    await expect(fromBytes(new Uint8Array([1, 2, 3]))).rejects.toThrow()
    const other = await toBytes({ format: 'something', info: {} } as never)
    await expect(fromBytes(other)).rejects.toThrow()
  })
})
