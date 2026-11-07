import type { Hex, Point } from '../core/hex'
import type { GameMap } from './map'

export type PlayerId = 0 | 1
export const HUMAN: PlayerId = 0
export const RIVAL: PlayerId = 1
export const PLAYERS: readonly PlayerId[] = [HUMAN, RIVAL]

// null means nobody's: wild land or a neutral village
export type Owner = PlayerId | null

// Ford: a walkable sandbar across a river or a strait between pieces of land
export type Terrain = 'field' | 'forest' | 'mountain' | 'water' | 'ford'

export type MapType = 'continent' | 'lakes' | 'peninsulas' | 'islands'
export const MAP_TYPES: readonly MapType[] = ['continent', 'lakes', 'peninsulas', 'islands']
export type MapSize = 'small' | 'medium' | 'large'
export const MAP_SIZES: readonly MapSize[] = ['small', 'medium', 'large']

export type BuildingKind = 'farm' | 'forge' | 'tower'
export const BUILDING_KINDS: readonly BuildingKind[] = ['farm', 'forge', 'tower']

// A building belongs to whoever owns its tile, so a raid that repaints the tile takes it over
export interface Building {
  readonly kind: BuildingKind
  reload: number // seconds until a tower can shoot again
}

export interface Cell {
  readonly hex: Hex
  readonly index: number
  terrain: Terrain
  owner: Owner
  village: Village | null
  building: Building | null
}

export interface Village {
  readonly id: number
  readonly cell: Cell
  owner: Owner
  population: number // fractional: grows a little every tick
  capital: boolean // each player has one capital, marked with a crown
  capturedAt: number // match time of the last capture; the longer-held village wins a tied tile
}

export interface Squad {
  readonly id: number
  readonly owner: PlayerId
  count: number
  strength: number // what one member is worth in a fight: soldiers from a forge village count double
  path: Cell[] // from the start cell to the destination
  step: number // index in path of the cell the squad is leaving
  progress: number // 0..1 on the way from path[step] to path[step + 1]
  home: Village // where the squad returns after a raid
  start: Point | null // where a redirected squad set off from, instead of the center of path[0]
  // Position in hex radii (as hexToPoint with size 1); the previous tick's one lets the renderer move squads smoothly
  x: number
  y: number
  prevX: number
  prevY: number
}

// A tower's arrow in flight, kept only for drawing
export interface Arrow {
  readonly from: Point
  readonly to: Point
  age: number // seconds since the shot
}

export interface World {
  readonly map: GameMap
  readonly mapType: MapType
  readonly villages: Village[]
  squads: Squad[]
  gold: Record<PlayerId, number>
  arrows: Arrow[]
  time: number // seconds since the match started
  winner: PlayerId | null
  nextId: number
}

export function newWorld(map: GameMap, villages: Village[], mapType: MapType = 'continent'): World {
  return { map, mapType, villages, squads: [], gold: { 0: 0, 1: 0 }, arrows: [], time: 0, winner: null, nextId: 0 }
}

export function opponent(player: PlayerId): PlayerId {
  return player === HUMAN ? RIVAL : HUMAN
}
