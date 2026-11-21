import { describe, expect, it } from 'vitest'
import { Game } from './game'
import { decodeMapCode } from './mapCode'
import { type Replay, fromBytes, toBytes } from './replays/format'
import golden from './sim/golden-replay.json'
import { TICK_SECONDS } from './sim/rules'
import { encodeStart, fingerprint } from './sim/snapshot'

describe('a game', () => {
  it('recreates the initial map from a rematch or its code even when type and season were random', () => {
    const game = new Game(4)
    game.settings = { size: 'large', type: 'random', season: 'random', rivals: 3, beasts: 'many', difficulty: 'hard' }
    game.restart(4_294_967_300)
    const initial = encodeStart(game.world)
    const code = game.mapCode!
    const decoded = decodeMapCode(` ${code.toLowerCase()} `)
    expect(decoded).toMatchObject({ match: { difficulty: 'hard', map: {
      seed: 4, size: 'large', type: initial.mapType, season: initial.season, rivals: 3, beasts: 'many',
    } } })
    if ('error' in decoded) throw new Error('The map code did not decode')

    game.world.villages[0].population = 1
    game.world.ticks = 200
    game.world.winner = 0
    game.settings = { ...game.settings, size: 'small', rivals: 1, difficulty: 'normal' }
    expect(game.rematch()).toBe(true)
    expect(game.world.winner).toBeNull()
    expect(encodeStart(game.world)).toEqual(initial)
    expect(game.mapCode).toBe(code)

    const imported = new Game(8)
    imported.startFromMap({ ...decoded.match, difficulty: 'easy' })
    expect(encodeStart(imported.world)).toEqual(initial)
    imported.world.winner = 0
    expect(imported.replay()?.info.difficulty).toBe('easy')
  })

  it('rejects malformed, incompatible and out-of-range map codes', () => {
    expect(decodeMapCode('not a code')).toEqual({ error: 'invalid' })
    expect(decodeMapCode('WF2-4-000010')).toEqual({ error: 'version' })
    expect(decodeMapCode('WF1-ZZZZZZZ-000010')).toEqual({ error: 'invalid' })
    expect(decodeMapCode('WF1-4-000030')).toEqual({ error: 'invalid' }) // three rivals on a small map
  })

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
    expect(game.mapCode).toBeNull()
    expect(game.rematch()).toBe(false)
  })

  it('freezes playback while seeking and applies only the latest target', async () => {
    const replay = golden as Replay
    const game = new Game(4)
    const expected = new Game(4)
    game.open(replay)
    expected.open(replay)
    expected.watch(347)
    game.paused = false

    let superseded = false
    game.seek(replay.info.ticks, () => { superseded = true })
    expect(game.seekingTo).toBe(replay.info.ticks)
    game.update(TICK_SECONDS)
    expect(game.world.ticks).toBe(0)

    const applied = await new Promise<boolean>((resolve) => game.seek(347, resolve))
    expect(applied).toBe(true)
    expect(game.seekingTo).toBeNull()
    expect(superseded).toBe(false)
    expect(game.paused).toBe(false)
    expect(fingerprint(game.world)).toBe(fingerprint(expected.world))
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
