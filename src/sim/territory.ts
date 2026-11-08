import type { GameMap } from './map'
import { isLand } from './rules'
import type { Cell, Owner, PlayerId, Village, World } from './world'

// A squad walking over a tile makes it theirs; village tiles change hands only by capture
export function paint(cell: Cell, owner: PlayerId): void {
  if (cell.village || !isLand(cell)) return
  cell.owner = owner
}

// The village tile always follows its village; the tiles around only where `canClaim` allows
export function claimAround(map: GameMap, village: Village, radius: number, canClaim = (_: Cell) => true): void {
  for (const cell of map.within(village.cell, radius)) {
    if (cell === village.cell || (isLand(cell) && !cell.village && canClaim(cell))) cell.owner = village.owner
  }
}

export function ownTiles(world: World, owner: PlayerId): number {
  return world.map.cells.filter((cell) => cell.owner === owner && isLand(cell)).length
}

// Share of all land tiles that belong to the owner, from 0 to 1
export function landShare(world: World, owner: Owner): number {
  const land = world.map.cells.filter(isLand)
  return land.filter((cell) => cell.owner === owner).length / land.length
}
