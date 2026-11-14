import { forget, readStored, store } from '../storage'
import { type Replay, type ReplayInfo, fromBytes, toBytes } from './format'

// Replays kept in the browser: the list on its own, so it opens without unpacking any of them,
// and each replay packed under a key of its own
const LIST_KEY = 'wayfold.replays'
const LIMIT_KEY = 'wayfold.replayLimit'
const replayKey = (id: string) => `wayfold.replay.${id}`

export const REPLAY_LIMITS = [1, 3, 5, 10, 20]
const DEFAULT_LIMIT = 5

// A starred replay stays until it is deleted; the others make way for newer ones beyond the limit
export interface SavedReplay {
  id: string
  starred: boolean
  info: ReplayInfo
}

// Newest first
export function savedReplays(): SavedReplay[] {
  try {
    const list = JSON.parse(readStored(LIST_KEY) ?? '[]') as SavedReplay[]
    return list.sort((a, b) => b.info.savedAt - a.info.savedAt)
  } catch {
    return []
  }
}

export function replayLimit(): number {
  const limit = Number(readStored(LIMIT_KEY))
  return REPLAY_LIMITS.includes(limit) ? limit : DEFAULT_LIMIT
}

// A lower limit lets the oldest unstarred replays go at once
export function setReplayLimit(limit: number): void {
  store(LIMIT_KEY, String(limit))
  keep(savedReplays())
}
// The same match saved again, e.g. from its file, takes the place of the one kept before
export async function saveReplay(replay: Replay, starred = false): Promise<SavedReplay | null> {
  const saved = { id: `${replay.info.savedAt.toString(36)}-${replay.info.end}`, starred, info: replay.info }
  const packed = toBase64(await toBytes(replay))
  let list = trim([saved, ...savedReplays().filter((other) => other.id !== saved.id)])
  if (!list.includes(saved)) return null // older than all the kept ones
  // When the storage is full, the oldest unstarred replays make room, as long as there are any
  while (!store(replayKey(saved.id), packed)) {
    const oldest = byAge(list).filter((other) => other !== saved).at(-1)
    if (!oldest) {
      list = remove(list, saved)
      break
    }
    list = remove(list, oldest)
  }
  writeList(list)
  return list.includes(saved) ? saved : null
}

export async function loadReplay(id: string): Promise<Replay> {
  const packed = readStored(replayKey(id))
  if (packed === null) throw new Error('No such replay')
  return fromBytes(fromBase64(packed))
}

export function deleteReplay(id: string): void {
  const list = savedReplays()
  writeList(remove(list, list.find((saved) => saved.id === id)))
}

export function starReplay(id: string, starred: boolean): void {
  const list = savedReplays()
  const saved = list.find((other) => other.id === id)
  if (saved) saved.starred = starred
  keep(list)
}

// The replays that would go with this limit, and with this one's star taken off: the player is told before
export function droppedBy(limit: number, unstarred?: string): string[] {
  const list = savedReplays().map((saved) => (saved.id === unstarred ? { ...saved, starred: false } : saved))
  return byAge(list).slice(limit).map((saved) => saved.id)
}

function keep(list: SavedReplay[]): void {
  writeList(trim(list))
}

// Drops the unstarred replays beyond the limit, the oldest first
function trim(list: SavedReplay[]): SavedReplay[] {
  for (const old of byAge(list).slice(replayLimit())) list = remove(list, old)
  return list
}

// The unstarred ones, newest first
function byAge(list: SavedReplay[]): SavedReplay[] {
  return list.filter((saved) => !saved.starred).sort((a, b) => b.info.savedAt - a.info.savedAt)
}

function remove(list: SavedReplay[], saved: SavedReplay | undefined): SavedReplay[] {
  if (!saved) return list
  forget(replayKey(saved.id))
  return list.filter((other) => other !== saved)
}

function writeList(list: SavedReplay[]): void {
  store(LIST_KEY, JSON.stringify(list))
}

// Storage keeps text, so the packed bytes go in as base64
function toBase64(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0))
}
