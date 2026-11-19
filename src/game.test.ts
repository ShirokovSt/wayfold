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

  it('resumes an unfinished match with its original world, rivals and recording after watching a saved replay', () => {
    const saved = new Game(12)
    saved.world.winner = 0
    const replay = saved.replay()!
    const game = new Game(4)
    const uninterrupted = new Game(4)
    game.started = true
    game.paused = uninterrupted.paused = false
    for (let i = 0; i < 130; i++) {
      game.update(TICK_SECONDS)
      uninterrupted.update(TICK_SECONDS)
    }

    const live = game.world
    game.open(replay)
    game.watch(0)
    game.update(TICK_SECONDS)
    expect(game.world).not.toBe(live)
    expect(game.replayLength).toBe(replay.info.ticks)
    game.close()
    expect(game.world).toBe(live)
    expect(game.started).toBe(true)
    expect(game.paused).toBe(true)
    expect(game.watching).toBe(false)
    expect(game.opened).toBeNull()
    expect(game.replayLength).toBe(130)

    game.paused = false
    for (let i = 0; i < 180; i++) {
      game.update(TICK_SECONDS)
      uninterrupted.update(TICK_SECONDS)
    }
    expect(game.world.orders).toEqual(uninterrupted.world.orders)
    expect(fingerprint(game.world)).toBe(fingerprint(uninterrupted.world))
  })
})
