import { BASE_GROWTH, GROWTH_PER_TILE, POPULATION_CAP } from './rules'
import { landAround } from './territory'
import type { Village, World } from './world'

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
