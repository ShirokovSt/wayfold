import { hexDistance } from '../core/hex'
import { ESTATE_RADIUS, isLand } from './rules'
import type { BuildingKind, Cell, Village, World } from './world'

// The village an own tile works for: the nearest village of the same owner;
// on a tie the one held longer wins, then the older one
export function estateVillage(world: World, cell: Cell): Village | null {
  if (cell.owner === null || !isLand(cell)) return null
  let best: Village | null = null
  let bestDistance = Infinity
  for (const village of world.villages) {
    if (village.owner !== cell.owner) continue
    const distance = hexDistance(village.cell.hex, cell.hex)
    const closer = distance < bestDistance
    const tieWon = distance === bestDistance && best !== null && heldLonger(village, best)
    if (closer || tieWon) {
      best = village
      bestDistance = distance
    }
  }
  return best
}

// The estate tiles that count for the village: its own tiles within ESTATE_RADIUS, the village tile not included
export function estateTiles(world: World, village: Village): Cell[] {
  if (village.owner === null) return []
  return world.map
    .within(village.cell, ESTATE_RADIUS)
    .filter((cell) => cell !== village.cell && estateVillage(world, cell) === village)
}

export function estateBuildings(world: World, village: Village, kind: BuildingKind): Cell[] {
  return estateTiles(world, village).filter((cell) => cell.building?.kind === kind)
}

function heldLonger(a: Village, b: Village): boolean {
  return a.capturedAt < b.capturedAt || (a.capturedAt === b.capturedAt && a.id < b.id)
}
