import { hexDistance } from '../core/hex'
import { BASE_GROWTH, GROWTH_PER_TILE, POPULATION_CAP } from './rules'
import { landAround } from './territory'
import type { Cell, PlayerId, Village, World } from './world'

// People per second; neutral villages only keep their garrison
export function growthRate(world: World, village: Village): number {
  if (village.owner === null) return 0
  return BASE_GROWTH + GROWTH_PER_TILE * landAround(world.map, village)
}

export function growVillages(world: World, dt: number): void {
  for (const village of world.villages) {
    if (village.population >= POPULATION_CAP) continue
    village.population = Math.min(POPULATION_CAP, village.population + growthRate(world, village) * dt)
  }
}

// A player without a capital gets a new one: the most populous village, the closest to `near` on a tie
export function ensureCapital(world: World, player: PlayerId, near: Cell): void {
  const own = world.villages.filter((village) => village.owner === player)
  if (own.length === 0 || own.some((village) => village.capital)) return
  own.sort((a, b) =>
    Math.floor(b.population) - Math.floor(a.population) ||
    hexDistance(a.cell.hex, near.hex) - hexDistance(b.cell.hex, near.hex))
  own[0].capital = true
}
