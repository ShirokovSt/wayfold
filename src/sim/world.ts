import type { Hex, Point } from '../core/hex'
import type { GameMap } from './map'
import type { Share } from './squads'

export type PlayerId = 0 | 1
export const HUMAN: PlayerId = 0
export const RIVAL: PlayerId = 1
export const PLAYERS: readonly PlayerId[] = [HUMAN, RIVAL]

// null means nobody's: wild land or a neutral village
export type Owner = PlayerId | null

// Ford: a walkable sandbar across a river or a strait between pieces of land;
// ice: a river or lake frozen in winter, walkable but not land anyone owns
export type Terrain = 'field' | 'forest' | 'mountain' | 'water' | 'ford' | 'ice'

// Each match is played in one season; it changes how fast squads walk and villages grow
export type Season = 'summer' | 'autumn' | 'winter' | 'spring'
export const SEASONS: readonly Season[] = ['summer', 'autumn', 'winter', 'spring']

export type MapType = 'continent' | 'lakes' | 'peninsulas' | 'islands'
export const MAP_TYPES: readonly MapType[] = ['continent', 'lakes', 'peninsulas', 'islands']
export type MapSize = 'small' | 'medium' | 'large'
export const MAP_SIZES: readonly MapSize[] = ['small', 'medium', 'large']

export type BuildingKind = 'farm' | 'tower'
export const BUILDING_KINDS: readonly BuildingKind[] = ['farm', 'tower']

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
  lair: Lair | null
  wild: boolean // next to a wolves' den: nobody can own it while the den stands, and wolves bite passers-by
}

// How many dens a new map gets
export type Beasts = 'none' | 'few' | 'many'
export const BEASTS: readonly Beasts[] = ['none', 'few', 'many']

// A wolves' den; its pack grows back slowly and now and then runs at the nearest village
export interface Lair {
  readonly cell: Cell
  readonly pair: number // a den and its mirror image share it, so both raid at the same moments
  readonly size: number // the most wolves it holds
  pack: number // wolves at home, fractional as it grows back
  raidIn: number // seconds until the next raid
  raids: number
}

// Wolves on a raid, or on their way back to the den
export interface Pack {
  readonly id: number
  readonly lair: Lair
  count: number
  path: Cell[]
  step: number
  progress: number
  returning: boolean
  // Position in hex radii, like a squad's
  x: number
  y: number
  prevX: number
  prevY: number
}

export interface Village {
  readonly id: number
  readonly cell: Cell
  owner: Owner
  population: number // fractional: grows a little every tick
  capital: boolean // each player has one capital, marked with a crown
  town: boolean // upgraded: its people are soldiers, attacking and defending; a captured town stays one
  capturedAt: number // match time of the last capture; the longer-held village wins a tied tile
}

export interface Squad {
  readonly id: number
  readonly owner: PlayerId
  count: number
  strength: number // what one member is worth in a fight: soldiers from a town count double
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

// A wolf leaping out of its den at a squad in the wild land: the bite lands halfway, then it runs back
export interface Bite {
  readonly from: Point // the den
  readonly squad: Squad
  age: number // seconds since it leapt
  hit: boolean
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
  lairs: Lair[]
  packs: Pack[]
  gold: Record<PlayerId, number>
  arrows: Arrow[]
  bites: Bite[]
  time: number // seconds since the match started
  ticks: number // simulation steps since the match started
  biteIn: number // seconds until wolves bite squads in the wild land again
  winner: PlayerId | null
  nextId: number
  orders: Order[] // everything the players ordered, so the match can be watched again
}

// An order and the tick it was given on; villages and tiles by their cell's index, squads by id
export type Order = { at: number; player: PlayerId } & (
  | { kind: 'send'; from: number; to: number; share: Share }
  | { kind: 'redirect'; squad: number; to: number }
  | { kind: 'build'; cell: number; building: BuildingKind }
  | { kind: 'town'; village: number }
)

export function newWorld(map: GameMap, villages: Village[], mapType: MapType = 'continent', lairs: Lair[] = []): World {
  return {
    map, mapType, villages, squads: [], lairs, packs: [], gold: { 0: 0, 1: 0 }, arrows: [], bites: [], time: 0, ticks: 0,
    biteIn: 0, winner: null, nextId: 0, orders: [],
  }
}

export function opponent(player: PlayerId): PlayerId {
  return player === HUMAN ? RIVAL : HUMAN
}
