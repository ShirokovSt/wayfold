import { SQRT3, hexDistance, hexToPoint } from '../core/hex'
import { TOWER_RANGE, TOWER_RELOAD, TOWER_VOLLEY } from './rules'
import type { Cell, Pack, PlayerId, Squad, World } from './world'

export const ARROW_SECONDS = 0.35 // how long an arrow is drawn flying

// Each tower shoots volleys at the nearest enemy squad or wolf pack in range; big ones lose more per volley
export function fireTowers(world: World, dt: number): void {
  for (const arrow of world.arrows) arrow.age += dt
  world.arrows = world.arrows.filter((arrow) => arrow.age < ARROW_SECONDS)

  for (const cell of world.map.cells) {
    const tower = cell.building
    if (tower?.kind !== 'tower' || cell.owner === null) continue
    tower.reload = Math.max(0, tower.reload - dt)
    if (tower.reload > 0) continue

    const from = hexToPoint(cell.hex, 1)
    let target: Squad | Pack | null = null
    let bestDistance = TOWER_RANGE * SQRT3 + 0.1 // neighbor centers are √3 apart
    const enemies = [...world.squads.filter((squad) => squad.owner !== cell.owner), ...world.packs]
    for (const enemy of enemies) {
      const distance = Math.hypot(enemy.x - from.x, enemy.y - from.y)
      if (enemy.count > 0 && distance < bestDistance) {
        target = enemy
        bestDistance = distance
      }
    }
    if (!target) continue
    target.count -= Math.max(1, Math.round(target.count * TOWER_VOLLEY))
    tower.reload = TOWER_RELOAD
    world.arrows.push({ from, to: { x: target.x, y: target.y }, age: 0 })
  }
  world.squads = world.squads.filter((squad) => squad.count > 0)
  world.packs = world.packs.filter((pack) => pack.count > 0)
}

// Everything within a tower's range that is its owner's or nobody's is guarded:
// tiles, villages and the tower itself can be taken from there only by soldiers
export function isGuarded(world: World, cell: Cell, against: PlayerId): boolean {
  if (cell.owner === against) return false
  return world.map.cells.some(
    (tower) =>
      tower.building?.kind === 'tower' &&
      tower.owner !== null &&
      tower.owner !== against &&
      (cell.owner === tower.owner || cell.owner === null) &&
      hexDistance(tower.hex, cell.hex) <= TOWER_RANGE,
  )
}

export function isSoldiers(squad: Squad): boolean {
  return squad.strength > 1
}

// Whether the squad can repaint the tile or take the village on it; wild land is nobody's while its den stands
export function canTake(world: World, squad: Squad, cell: Cell): boolean {
  return !cell.wild && (isSoldiers(squad) || !isGuarded(world, cell, squad.owner))
}
