import { GameMap } from './map'
import { type Owner, type Terrain, type Village, type World, newWorld } from './world'

// Small hand-made worlds for tests; `rows` draws the terrain: . field, f forest, m mountain, w water, o ford
export function testWorld(rows: string[]): World {
  const map = new GameMap(rows[0].length, rows.length)
  const terrain: Record<string, Terrain> = { '.': 'field', f: 'forest', m: 'mountain', w: 'water', o: 'ford' }
  for (const [row, line] of rows.entries()) {
    for (let col = 0; col < map.rowLength(row); col++) map.cellAtOffset(col, row)!.terrain = terrain[line[col]]
  }
  return newWorld(map, [])
}

export function addVillage(world: World, col: number, row: number, owner: Owner, population: number, capital = false): Village {
  const cell = world.map.cellAtOffset(col, row)!
  const village = { id: world.villages.length, cell, owner, population, capital, capturedAt: 0 }
  cell.village = village
  cell.owner = owner
  world.villages.push(village)
  return village
}
