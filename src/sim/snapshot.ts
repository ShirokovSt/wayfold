import { GameMap } from './map'
import {
  type BuildingKind, type Lair, type MapType, PLAYERS, type PlayerId, type Season, type Terrain, type Village, type World, newWorld,
} from './world'

// Raise it with every change to the rules that plays the same orders out differently: replays recorded
// with another number can't be watched. The golden replay test tells when that is needed
export const SIM_VERSION = 1

// A match as it starts, small enough to keep: one letter per tile, the villages and dens by their tile's index
export interface Start {
  width: number
  height: number
  season: Season
  mapType: MapType
  players: number
  terrain: string
  owners: string // a player's number, or '-' for nobody
  wild: string // '1' next to a den
  buildings: { cell: number; kind: BuildingKind; reload: number }[]
  villages: (Omit<Village, 'cell'> & { cell: number })[]
  lairs: (Omit<Lair, 'cell'> & { cell: number })[]
  gold: number[]
  biteIn: number
  nextId: number
}

const TERRAINS: Terrain[] = ['field', 'forest', 'mountain', 'water', 'ford', 'ice']

export function encodeStart(world: World): Start {
  if (world.ticks !== 0 || world.squads.length > 0 || world.packs.length > 0) throw new Error('Not the start of a match')
  const cells = world.map.cells
  return {
    width: world.map.width,
    height: world.map.height,
    season: world.map.season,
    mapType: world.mapType,
    players: world.players.length,
    terrain: cells.map((cell) => TERRAINS.indexOf(cell.terrain)).join(''),
    owners: cells.map((cell) => cell.owner ?? '-').join(''),
    wild: cells.map((cell) => (cell.wild ? 1 : 0)).join(''),
    buildings: cells.filter((cell) => cell.building).map((cell) => ({ cell: cell.index, ...cell.building! })),
    villages: world.villages.map((village) => ({ ...village, cell: village.cell.index })),
    lairs: world.lairs.map((lair) => ({ ...lair, cell: lair.cell.index })),
    gold: PLAYERS.map((player) => world.gold[player]),
    biteIn: world.biteIn,
    nextId: world.nextId,
  }
}

export function decodeStart(start: Start): World {
  const map = new GameMap(start.width, start.height)
  map.season = start.season
  map.cells.forEach((cell, i) => {
    cell.terrain = TERRAINS[Number(start.terrain[i])]
    cell.owner = start.owners[i] === '-' ? null : (Number(start.owners[i]) as PlayerId)
    cell.wild = start.wild[i] === '1'
  })
  for (const { cell, ...building } of start.buildings) map.cells[cell].building = building
  const villages = start.villages.map((village) => ({ ...village, cell: map.cells[village.cell] }))
  for (const village of villages) village.cell.village = village
  const lairs = start.lairs.map((lair) => ({ ...lair, cell: map.cells[lair.cell] }))
  for (const lair of lairs) lair.cell.lair = lair
  const world = newWorld(map, villages, start.mapType, lairs, start.players)
  PLAYERS.forEach((player, i) => (world.gold[player] = start.gold[i]))
  world.biteIn = start.biteIn
  world.nextId = start.nextId
  return world
}

// A short mark of everything in the world that the rules move: two worlds with the same one are the same
export function fingerprint(world: World): string {
  const state = {
    ticks: world.ticks,
    winner: world.winner,
    out: world.out,
    gold: world.gold,
    biteIn: world.biteIn,
    nextId: world.nextId,
    cells: world.map.cells.map((cell) => [cell.terrain, cell.owner, cell.wild, cell.building]),
    villages: world.villages.map(({ cell, ...village }) => [cell.index, village]),
    lairs: world.lairs.map(({ cell, ...lair }) => [cell.index, lair]),
    squads: world.squads.map((squad) => [squad.id, squad.owner, squad.count, squad.strength, squad.x, squad.y, squad.home.id]),
    packs: world.packs.map((pack) => [pack.id, pack.count, pack.x, pack.y, pack.returning]),
  }
  // FNV-1a, a simple and well-spread hash
  let hash = 0x811c9dc5
  for (const char of JSON.stringify(state)) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, '0')
}
