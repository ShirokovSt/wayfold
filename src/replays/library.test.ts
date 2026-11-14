import { beforeEach, describe, expect, it } from 'vitest'
import { addVillage, handmadeWorld } from '../sim/handmade'
import { encodeStart } from '../sim/snapshot'
import { HUMAN, RIVAL } from '../sim/world'
import { type Replay, newReplay } from './format'
import { deleteReplay, droppedBy, loadReplay, replayLimit, saveReplay, savedReplays, setReplayLimit, starReplay } from './library'

// The browser's storage, kept in memory; `room` is how many characters it holds
function useStorage(room = Infinity): void {
  const data = new Map<string, string>()
  const used = () => [...data.values()].reduce((sum, value) => sum + value.length, 0)
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (used() - (data.get(key)?.length ?? 0) + value.length > room) throw new Error('The storage is full')
      data.set(key, value)
    },
    removeItem: (key: string) => data.delete(key),
  }
  Object.assign(globalThis, { localStorage: storage })
}

function replay(savedAt: number): Replay {
  const world = handmadeWorld(['.......', '......', '.......'])
  addVillage(world, 0, 0, HUMAN, 10, true)
  addVillage(world, 6, 2, RIVAL, 10, true)
  const info = {
    savedAt, ticks: 100, mapType: 'continent', size: 'small', season: 'summer', players: 2, difficulty: 'normal',
    beasts: 'none', place: 1, end: 'cafe0000',
  } as const
  return newReplay(info, encodeStart(world), [{ at: 5, player: HUMAN, kind: 'send', from: 0, to: 3, share: 'all' }])
}

const times = () => savedReplays().map((saved) => saved.info.savedAt)

describe('kept replays', () => {
  beforeEach(() => useStorage())

  it('are the last five by default, newest first, and load as they were saved', async () => {
    for (let time = 1; time <= 7; time++) await saveReplay(replay(time))
    expect(replayLimit()).toBe(5)
    expect(times()).toEqual([7, 6, 5, 4, 3])
    expect(await loadReplay(savedReplays()[0].id)).toEqual(replay(7))
  })

  it('keep a starred one beyond the limit, and lose the oldest at once when the limit is lowered', async () => {
    for (let time = 1; time <= 5; time++) await saveReplay(replay(time))
    starReplay(savedReplays().at(-1)!.id, true)
    for (let time = 6; time <= 8; time++) await saveReplay(replay(time))
    expect(times()).toEqual([8, 7, 6, 5, 4, 1])
    setReplayLimit(3)
    expect(times()).toEqual([8, 7, 6, 1])
    deleteReplay(savedReplays()[0].id)
    expect(times()).toEqual([7, 6, 1])
  })

  it('tell beforehand which ones a lower limit or a star taken off would delete', async () => {
    for (let time = 1; time <= 5; time++) await saveReplay(replay(time))
    const id = (time: number) => savedReplays().find((saved) => saved.info.savedAt === time)!.id
    starReplay(id(1), true)
    expect(droppedBy(2)).toEqual([id(3), id(2)])
    expect(droppedBy(5, id(1))).toEqual([])
    setReplayLimit(3)
    expect(droppedBy(3, id(1))).toEqual([id(1)]) // older than the three kept
    expect(times()).toEqual([5, 4, 3, 1]) // nothing is deleted just by asking
  })

  it('make room for a new one when the storage is full, the oldest unstarred going first', async () => {
    await saveReplay(replay(1))
    const size = localStorage.getItem(`wayfold.replay.${savedReplays()[0].id}`)!.length
    useStorage(size * 3.5) // a few replays and their list
    for (let time = 1; time <= 5; time++) await saveReplay(replay(time))
    const kept = times()
    expect(kept.length).toBeGreaterThan(1)
    expect(kept.length).toBeLessThan(5)
    expect(kept).toEqual([5, 4, 3, 2].slice(0, kept.length)) // the newest ones
  })

  it('take an old match saved again, from its file, in place of the one kept before', async () => {
    await saveReplay(replay(1))
    await saveReplay(replay(1), true)
    expect(savedReplays()).toHaveLength(1)
    expect(savedReplays()[0].starred).toBe(true)
  })
})
