import type { Hex } from '../core/hex'
import type { GameMap } from './map'

export type PlayerId = 0 | 1
export const HUMAN: PlayerId = 0
export const RIVAL: PlayerId = 1
export const PLAYERS: readonly PlayerId[] = [HUMAN, RIVAL]

// null means nobody's: wild land or a neutral village
export type Owner = PlayerId | null

export type Terrain = 'field' | 'forest' | 'mountain' | 'water' | 'ford'

export interface Cell {
  readonly hex: Hex
  readonly index: number
  terrain: Terrain
  owner: Owner
  village: Village | null
}

export interface Village {
  readonly id: number
  readonly cell: Cell
  owner: Owner
  population: number // fractional: grows a little every tick
}

export interface Squad {
  readonly id: number
  readonly owner: PlayerId
  count: number
  path: Cell[] // from the start cell to the destination
  step: number // index in path of the cell the squad is leaving
  progress: number // 0..1 on the way from path[step] to path[step + 1]
  home: Village // where the squad returns after a raid
  // Position in tile units; the previous tick's one lets the renderer move squads smoothly
  x: number
  y: number
  prevX: number
  prevY: number
}

export interface World {
  readonly map: GameMap
  readonly villages: Village[]
  squads: Squad[]
  time: number // seconds since the match started
  winner: PlayerId | null
  nextId: number
}

export function opponent(player: PlayerId): PlayerId {
  return player === HUMAN ? RIVAL : HUMAN
}
