import type { GameMap } from './map'
import { isPassable } from './rules'
import type { Cell, Owner, PlayerId, Village, World } from './world'

// A squad walking over a tile makes it theirs; village tiles change hands only by capture
export function paint(cell: Cell, owner: PlayerId): void {
  if (cell.village || !isPassable(cell)) return
  cell.owner = owner
}

export function claimAround(map: GameMap, village: Village, radius: number): void {
  for (const cell of map.within(village.cell, radius)) {
    if (isPassable(cell) && (!cell.village || cell === village.cell)) cell.owner = village.owner
  }
}

export function ownTiles(world: World, owner: PlayerId): number {
  return world.map.cells.filter((cell) => cell.owner === owner && isPassable(cell)).length
}

// Share of all walkable tiles that belong to the owner, from 0 to 1
export function landShare(world: World, owner: Owner): number {
  const land = world.map.cells.filter(isPassable)
  return land.filter((cell) => cell.owner === owner).length / land.length
}
