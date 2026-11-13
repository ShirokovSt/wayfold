import { describe, expect, it } from 'vitest'
import { Rival } from '../ai/rival'
import { createRandom } from '../core/rng'
import { type Replay, newReplay } from '../replays/format'
import golden from './golden-replay.json'
import { createWorld } from './mapgen'
import { Recording } from './replay'
import { TICK_SECONDS } from './rules'
import { SIM_VERSION, decodeStart, encodeStart, fingerprint } from './snapshot'
import { tick } from './tick'

// A match recorded once and kept, which the rules must still play out to the same end, as saved replays need.
// When a change to the rules makes it fail on purpose, raise SIM_VERSION, so the replays saved before
// are no longer offered for watching, and record the match again:
//   $env:UPDATE_GOLDEN=1; npx vitest run golden    (PowerShell; UPDATE_GOLDEN=1 npx vitest run golden elsewhere)
const GOLDEN_PATH = 'src/sim/golden-replay.json'
const updating = Boolean((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.UPDATE_GOLDEN)

describe('the golden replay', () => {
  it.skipIf(updating)('plays out as it was recorded', () => {
    const replay = golden as unknown as Replay
    expect(replay.info.sim, 'recorded with other rules: record it again').toBe(SIM_VERSION)
    const recording = new Recording(decodeStart(replay.start), replay.orders, () => replay.info.ticks)
    const end = fingerprint(recording.at(replay.info.ticks))
    expect(end, 'the rules play it out differently: raise SIM_VERSION and record it again').toBe(replay.info.end)
  })

  // Four hard rivals in winter, with many wolves: towns, towers, ice and dens all come into play
  it.runIf(updating)('is recorded again', async () => {
    const world = createWorld(2026, { size: 'medium', type: 'continent', season: 'winter', beasts: 'many', players: 4 })
    const recording = Recording.of(world)
    const rivals = world.players.map((player, i) => new Rival(player, createRandom(7 + i), 'hard'))
    while (world.winner === null && world.ticks < 4 * 60 / TICK_SECONDS) {
      for (const rival of rivals) rival.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
      recording.note(world)
    }
    const info = {
      savedAt: 0, ticks: world.ticks, mapType: world.mapType, size: 'medium', season: world.map.season, players: 4,
      difficulty: 'hard', beasts: 'many', place: 1, end: fingerprint(world),
    } as const
    const fs = await import('node:' + 'fs') // node's own module, only for this
    fs.writeFileSync(GOLDEN_PATH, JSON.stringify(newReplay(info, encodeStart(recording.start), world.orders)) + '\n')
  }, 60_000)
})
