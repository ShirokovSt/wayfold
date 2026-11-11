import { makeLair } from './beasts'
import { GameMap } from './map'
import { type Lair, type Owner, type Terrain, type Village, type World, newWorld } from './world'

const TERRAIN: Record<string, Terrain> = { '.': 'field', f: 'forest', m: 'mountain', w: 'water', o: 'ford' }

// Worlds drawn by hand, for the tutorial and for tests; `rows` draws the terrain:
// . field, f forest, m mountain, w water, o ford (odd rows are one tile shorter)
export function handmadeWorld(rows: string[]): World {
  const map = new GameMap(rows[0].length, rows.length)
  for (const [row, line] of rows.entries()) {
    for (let col = 0; col < map.rowLength(row); col++) map.cellAtOffset(col, row)!.terrain = TERRAIN[line[col]]
  }
  return newWorld(map, [])
}

export function addLair(world: World, col: number, row: number, size: number): Lair {
  const lair = makeLair(world.map, world.map.cellAtOffset(col, row)!, world.lairs.length, size)
  world.lairs.push(lair)
  return lair
}

export function addVillage(world: World, col: number, row: number, owner: Owner, population: number, capital = false): Village {
  const cell = world.map.cellAtOffset(col, row)!
  const village = { id: world.villages.length, cell, owner, population, capital, town: false, capturedAt: 0 }
  cell.village = village
  cell.owner = owner
  world.villages.push(village)
  return village
}
