import { hexDistance } from '../core/hex'
import { estateTiles } from './estates'
import { BUILDING_COST, GOLD_PER_TILE, TOWER_RANGE, TOWN_COST } from './rules'
import { ownTiles } from './territory'
import { type BuildingKind, type Cell, PLAYERS, type PlayerId, type Village, type World, opponent } from './world'

// What gold buys: a building on a field, or a village's upgrade to a town
export type Project = BuildingKind | 'town'

export function costOf(project: Project): number {
  return project === 'town' ? TOWN_COST : BUILDING_COST[project]
}

// Every own tile brings in a little gold
export function collectGold(world: World, dt: number): void {
  for (const player of PLAYERS) world.gold[player] += GOLD_PER_TILE * ownTiles(world, player) * dt
}

// Buildings go on an own empty field inside the estate of one of the player's villages
export function canBuildOn(world: World, player: PlayerId, cell: Cell): boolean {
  if (cell.owner !== player || cell.village || cell.building || cell.terrain !== 'field') return false
  return world.villages.some((village) => village.owner === player && estateTiles(world, village).includes(cell))
}

// A tower may not guard the doorstep of an enemy village, otherwise it would choke it
export function canBuild(world: World, player: PlayerId, cell: Cell, kind: BuildingKind): boolean {
  return canBuildOn(world, player, cell) && (kind !== 'tower' || !nearEnemyVillage(world, player, cell))
}

export function nearEnemyVillage(world: World, player: PlayerId, cell: Cell): boolean {
  return world.villages.some(
    (village) => village.owner === opponent(player) && hexDistance(village.cell.hex, cell.hex) <= TOWER_RANGE,
  )
}

export function build(world: World, player: PlayerId, cell: Cell, kind: BuildingKind): boolean {
  const cost = BUILDING_COST[kind]
  if (!canBuild(world, player, cell, kind) || world.gold[player] < cost) return false
  world.gold[player] -= cost
  cell.building = { kind, reload: 0 }
  return true
}

export function canUpgrade(player: PlayerId, village: Village): boolean {
  return village.owner === player && !village.town
}

export function upgradeToTown(world: World, player: PlayerId, village: Village): boolean {
  if (!canUpgrade(player, village) || world.gold[player] < TOWN_COST) return false
  world.gold[player] -= TOWN_COST
  village.town = true
  return true
}
