import { SQRT3, hexToPoint } from '../core/hex'
import { TOWER_RANGE, TOWER_RELOAD, TOWER_VOLLEY } from './rules'
import type { Squad, World } from './world'

export const ARROW_SECONDS = 0.35 // how long an arrow is drawn flying

// Each tower shoots volleys at the nearest enemy squad in range; big squads lose more per volley
export function fireTowers(world: World, dt: number): void {
  for (const arrow of world.arrows) arrow.age += dt
  world.arrows = world.arrows.filter((arrow) => arrow.age < ARROW_SECONDS)

  for (const cell of world.map.cells) {
    const tower = cell.building
    if (tower?.kind !== 'tower' || cell.owner === null) continue
    tower.reload = Math.max(0, tower.reload - dt)
    if (tower.reload > 0) continue

    const from = hexToPoint(cell.hex, 1)
    let target: Squad | null = null
    let bestDistance = TOWER_RANGE * SQRT3 + 0.1 // neighbor centers are √3 apart
    for (const squad of world.squads) {
      const distance = Math.hypot(squad.x - from.x, squad.y - from.y)
      if (squad.owner !== cell.owner && squad.count > 0 && distance < bestDistance) {
        target = squad
        bestDistance = distance
      }
    }
    if (!target) continue
    target.count -= Math.max(1, Math.round(target.count * TOWER_VOLLEY))
    tower.reload = TOWER_RELOAD
    world.arrows.push({ from, to: { x: target.x, y: target.y }, age: 0 })
  }
  world.squads = world.squads.filter((squad) => squad.count > 0)
}
