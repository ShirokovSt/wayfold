import { hexDistance } from '../core/hex'
import { estateTiles } from './estates'
import { BUILDING_COST, CLEAR_COST, GOLD_PER_TILE, HARVEST_GOLD, SELL_SHARE, TOWER_RANGE, TOWN_COST } from './rules'
import { ownTiles } from './territory'
import { type BuildingKind, type Cell, type PlayerId, type Village, type World, isEnemy } from './world'

// What gold buys: a building on a field, a village's upgrade to a town, or a forest cut down to a field
export type Project = BuildingKind | 'town' | 'clear'

export function costOf(project: Project): number {
  return project === 'town' ? TOWN_COST : project === 'clear' ? CLEAR_COST : BUILDING_COST[project]
}

// Every own tile brings in a little gold, and in autumn every own farm its harvest
export function collectGold(world: World, dt: number): void {
  const harvest = world.map.season === 'autumn' ? HARVEST_GOLD : 0
  for (const player of world.players) {
    const farms = world.map.cells.filter((cell) => cell.owner === player && cell.building?.kind === 'farm').length
    world.gold[player] += (GOLD_PER_TILE * ownTiles(world, player) + harvest * farms) * dt
  }
}

// Buildings go on an own empty field inside the estate of one of the player's villages
export function canBuildOn(world: World, player: PlayerId, cell: Cell): boolean {
  return !cell.village && !cell.building && cell.terrain === 'field' && inOwnEstate(world, player, cell)
}

// Building, tearing down and clearing are done only here: a raid deep into enemy land
// takes the tiles it crosses, but not the right to pull down what stands on them
export function inOwnEstate(world: World, player: PlayerId, cell: Cell): boolean {
  if (cell.owner !== player) return false
  return world.villages.some((village) => village.owner === player && estateTiles(world, village).includes(cell))
}

// A tower may not guard the doorstep of an enemy village, otherwise it would choke it
export function canBuild(world: World, player: PlayerId, cell: Cell, kind: BuildingKind): boolean {
  return canBuildOn(world, player, cell) && (kind !== 'tower' || !nearEnemyVillage(world, player, cell))
}

export function nearEnemyVillage(world: World, player: PlayerId, cell: Cell): boolean {
  return world.villages.some(
    (village) => isEnemy(village.owner, player) && hexDistance(village.cell.hex, cell.hex) <= TOWER_RANGE,
  )
}

export function build(world: World, player: PlayerId, cell: Cell, kind: BuildingKind): boolean {
  const cost = BUILDING_COST[kind]
  if (!canBuild(world, player, cell, kind) || world.gold[player] < cost) return false
  world.gold[player] -= cost
  cell.building = { kind, reload: 0 }
  world.orders.push({ at: world.ticks, player, kind: 'build', cell: cell.index, building: kind })
  return true
}

export function canUpgrade(player: PlayerId, village: Village): boolean {
  return village.owner === player && !village.town
}

export function upgradeToTown(world: World, player: PlayerId, village: Village): boolean {
  if (!canUpgrade(player, village) || world.gold[player] < TOWN_COST) return false
  world.gold[player] -= TOWN_COST
  village.town = true
  world.orders.push({ at: world.ticks, player, kind: 'town', village: village.cell.index })
  return true
}

// A building in an own estate can be torn down, a captured one too, for part of its price back
export function refundOf(kind: BuildingKind): number {
  return Math.floor(BUILDING_COST[kind] * SELL_SHARE)
}

export function canSell(world: World, player: PlayerId, cell: Cell): boolean {
  return cell.building !== null && inOwnEstate(world, player, cell)
}

export function sell(world: World, player: PlayerId, cell: Cell): boolean {
  if (!canSell(world, player, cell)) return false
  world.gold[player] += refundOf(cell.building!.kind)
  cell.building = null
  world.orders.push({ at: world.ticks, player, kind: 'sell', cell: cell.index })
  return true
}

// A forest in an own estate becomes a field, to build on, and quicker to walk for everyone
export function canClear(world: World, player: PlayerId, cell: Cell): boolean {
  return cell.terrain === 'forest' && !cell.village && inOwnEstate(world, player, cell)
}

export function clearForest(world: World, player: PlayerId, cell: Cell): boolean {
  if (!canClear(world, player, cell) || world.gold[player] < CLEAR_COST) return false
  world.gold[player] -= CLEAR_COST
  cell.terrain = 'field'
  world.orders.push({ at: world.ticks, player, kind: 'clear', cell: cell.index })
  return true
}
