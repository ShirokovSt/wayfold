import { hexDistance } from '../core/hex'
import { estateBuildings, estateTiles } from './estates'
import { BASE_GROWTH, FARM_GROWTH, GROWTH_PER_TILE, POPULATION_CAP, SOLDIER_STRENGTH, TOWN_GROWTH } from './rules'
import type { Cell, PlayerId, Village, World } from './world'

// People per second, from the estate and its farms; neutral villages only keep their garrison
export function growthRate(world: World, village: Village): number {
  if (village.owner === null) return 0
  const farms = estateBuildings(world, village, 'farm').length
  const rate = BASE_GROWTH + GROWTH_PER_TILE * estateTiles(world, village).length + FARM_GROWTH * farms
  return village.town ? rate * TOWN_GROWTH : rate
}

// What one of the village's people is worth in a fight: a town's people are soldiers
export function strengthOf(village: Village): number {
  return village.town ? SOLDIER_STRENGTH : 1
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
