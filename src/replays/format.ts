import { version } from '../../package.json'
import type { Difficulty } from '../ai/rival'
import { SIM_VERSION, type Start } from '../sim/snapshot'
import type { Beasts, MapSize, MapType, Order, Season } from '../sim/world'

export const REPLAY_EXTENSION = '.wfreplay'
const FORMAT = 'wayfold-replay' // marks the file, so the game tells it from any other

// What the list of replays shows, without opening the replay itself
export interface ReplayInfo {
  savedAt: number // when the match ended, as Date.now()
  version: string // of the game that recorded it
  sim: number // of its rules: only this game's number can be watched
  ticks: number
  mapType: MapType
  size: MapSize
  season: Season
  players: number
  difficulty: Difficulty
  beasts: Beasts
  place: number // yours: 1 is a victory
  end: string // the fingerprint of the last moment, which watching it must come to
}

export interface Replay {
  format: typeof FORMAT
  info: ReplayInfo
  start: Start
  orders: Order[]
}

export function newReplay(info: Omit<ReplayInfo, 'version' | 'sim'>, start: Start, orders: Order[]): Replay {
  return { format: FORMAT, info: { ...info, version, sim: SIM_VERSION }, start, orders }
}

export function canWatch(info: ReplayInfo): boolean {
  return info.sim === SIM_VERSION
}

// A file is the replay written out as JSON and packed with gzip: a long match takes a few dozen kilobytes
export async function toBytes(replay: Replay): Promise<Uint8Array> {
  const stream = new Blob([JSON.stringify(replay)]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// Throws when the bytes are not a replay of this game
export async function fromBytes(bytes: Uint8Array): Promise<Replay> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  const replay = JSON.parse(await new Response(stream).text()) as Replay
  if (replay?.format !== FORMAT || !replay.info || !replay.start || !Array.isArray(replay.orders)) throw new Error('Not a replay')
  return replay
}
