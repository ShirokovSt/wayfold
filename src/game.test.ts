import { describe, expect, it } from 'vitest'
import { Game } from './game'
import { fromBytes, toBytes } from './replays/format'
import { TICK_SECONDS } from './sim/rules'
import { fingerprint } from './sim/snapshot'

describe('a game', () => {
  it('keeps a finished match as a replay that, opened later, comes to the same end', async () => {
    const game = new Game(4)
    game.settings = { ...game.settings, size: 'small', type: 'continent', rivals: 1, difficulty: 'hard' }
    game.restart(4)
    game.paused = false
    expect(game.replay()).toBeNull() // not over yet
    while (game.world.winner === null && game.world.time < 30 * 60) game.update(TICK_SECONDS)
    const end = fingerprint(game.world)

    const replay = await fromBytes(await toBytes(game.replay()!))
    expect(replay.info).toMatchObject({ size: 'small', difficulty: 'hard', players: 2, ticks: game.world.ticks, end })
    game.open(replay)
    game.watch(replay.info.ticks)
    expect(fingerprint(game.world)).toBe(end)
  }, 30_000)

  it('keeps no replay of the tutorial', () => {
    const game = new Game(1)
    game.startTutorial()
    game.world.winner = 0
    expect(game.replay()).toBeNull()
  })
})
