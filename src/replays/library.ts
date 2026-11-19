import { forget, readStored, store } from '../storage'
import { type Replay, type ReplayInfo, fromBytes, toBytes } from './format'

const LIST_KEY = 'wayfold.replays'
const LEGACY_LIMIT_KEY = 'wayfold.replayLimit'
const legacyReplayKey = (id: string) => `wayfold.replay.${id}`

export const REPLAY_LIMITS = [1, 3, 5, 10, 20]
const DEFAULT_LIMIT = 5

// A starred replay stays until it is deleted; the others make way for newer ones beyond the limit
export interface SavedReplay {
  id: string
  starred: boolean
  info: ReplayInfo
}

// Older libraries kept the packed replay under a separate key. New entries include it in the
// same storage value as the list so writing a replay and evicting old entries succeed together.
interface ReplayEntry extends SavedReplay {
  packed?: string
}

interface Library {
  limit: number
  entries: ReplayEntry[]
}

function readLibrary(): Library {
  try {
    const saved = JSON.parse(readStored(LIST_KEY) ?? '[]') as Library | ReplayEntry[]
    if (!Array.isArray(saved)) {
      if (!Array.isArray(saved?.entries)) throw new Error('Invalid replay library')
      return saved
    }
    const limit = Number(readStored(LEGACY_LIMIT_KEY))
    return {
      limit: REPLAY_LIMITS.includes(limit) ? limit : DEFAULT_LIMIT,
      entries: saved.sort((a, b) => b.info.savedAt - a.info.savedAt),
    }
  } catch {
    return { limit: DEFAULT_LIMIT, entries: [] }
  }
}

// Newest first, with no need to decompress any of the replays.
export function savedReplays(): SavedReplay[] {
  return readLibrary().entries.map(({ id, starred, info }) => ({ id, starred, info }))
}

export function replayLimit(): number {
  return readLibrary().limit
}

// A lower limit lets the oldest unstarred replays go at once
export function setReplayLimit(limit: number): void {
  const library = readLibrary()
  writeLibrary(library, trim(library.entries, limit), limit)
}

// The same match saved again, e.g. from its file, takes the place of the one kept before
export async function saveReplay(replay: Replay, starred = false): Promise<SavedReplay | null> {
  const packed = toBase64(await toBytes(replay))
  const library = readLibrary()
  const id = `${replay.info.savedAt.toString(36)}-${replay.info.end}`
  const previous = library.entries.find((entry) => entry.id === id)
  const saved = { id, starred: starred || previous?.starred === true, info: replay.info }
  const entry = { ...saved, packed }
  const entries = [entry, ...library.entries.filter((other) => other.id !== id)]
    .sort((a, b) => b.info.savedAt - a.info.savedAt)
  let kept = trim(entries, library.limit)
  if (!kept.includes(entry)) return null // older than all the kept ones
  // On quota failure, retry without the oldest unstarred replay. Each failed write leaves
  // the stored library intact, including when the new replay cannot fit by itself.
  const evictable = byAge(kept).filter((other) => other !== entry).reverse()
  while (!writeLibrary(library, kept)) {
    const oldest = evictable.shift()
    if (!oldest) return null
    kept = kept.filter((other) => other !== oldest)
  }
  return saved
}

export async function loadReplay(id: string): Promise<Replay> {
  const entry = readLibrary().entries.find((other) => other.id === id)
  if (!entry) throw new Error('No such replay')
  const packed = entry.packed ?? readStored(legacyReplayKey(id))
  if (packed === null) throw new Error('No such replay')
  return fromBytes(fromBase64(packed))
}

export function deleteReplay(id: string): void {
  const library = readLibrary()
  writeLibrary(library, library.entries.filter((entry) => entry.id !== id))
}

export function starReplay(id: string, starred: boolean): void {
  const library = readLibrary()
  const entries = library.entries.map((entry) => entry.id === id ? { ...entry, starred } : entry)
  writeLibrary(library, trim(entries, library.limit))
}

// The replays that would go with this limit, and with this one's star taken off: the player is told before
export function droppedBy(limit: number, unstarred?: string, entries = savedReplays()): string[] {
  const list = entries.map((saved) => (saved.id === unstarred ? { ...saved, starred: false } : saved))
  return byAge(list).slice(limit).map((saved) => saved.id)
}

// Drops the unstarred replays beyond the limit, the oldest first
function trim(list: ReplayEntry[], limit: number): ReplayEntry[] {
  const dropped = new Set(byAge(list).slice(limit))
  return list.filter((entry) => !dropped.has(entry))
}

// The unstarred ones, newest first
function byAge<T extends SavedReplay>(list: T[]): T[] {
  return list.filter((saved) => !saved.starred).sort((a, b) => b.info.savedAt - a.info.savedAt)
}

function writeLibrary(previous: Library, entries: ReplayEntry[], limit = previous.limit): boolean {
  if (!store(LIST_KEY, JSON.stringify({ limit, entries }))) return false
  const legacyIds = new Set(entries.filter((entry) => entry.packed === undefined).map((entry) => entry.id))
  for (const entry of previous.entries) {
    if (entry.packed === undefined && !legacyIds.has(entry.id)) forget(legacyReplayKey(entry.id))
  }
  return true
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
