import type { BuildingKind, Cell, Terrain } from './world'

// All the balance numbers in one place

export const TICK_SECONDS = 1 / 20

export const MAP_WIDTH = 17
export const MAP_HEIGHT = 11 // odd, so the map has a middle row
export const NEUTRAL_PAIRS = 3 // neutral villages on each side of the river

// How many field tiles a step onto this terrain is worth; Infinity is impassable
export const MOVE_COST: Record<Terrain, number> = {
  field: 1,
  forest: 2,
  ford: 1.6,
  mountain: Infinity,
  water: Infinity,
}

export const SQUAD_SPEED = 1.0 // field tiles per second
export const CLASH_DISTANCE = 0.7 // enemy squads closer than this fight (in hex radii; neighbor centers are 1.73 apart)

export const START_POPULATION = 10
export const NEUTRAL_GARRISON = { min: 5, max: 12 }
export const POPULATION_CAP = 50 // villages stop growing here, but can be reinforced above it

// A village grows by BASE_GROWTH + GROWTH_PER_TILE for each tile of its estate within ESTATE_RADIUS, per second.
// The estate is the player's tiles that are closer to this village than to their other villages.
export const BASE_GROWTH = 0.25
export const GROWTH_PER_TILE = 0.04
export const ESTATE_RADIUS = 3

export const GOLD_PER_TILE = 0.05 // gold per second for every own tile, wherever it is

export const BUILDING_COST: Record<BuildingKind, number> = { farm: 30, tower: 45, forge: 50 }
export const FARM_GROWTH = 0.25 // extra people per second for the village whose estate has the farm
export const FORGE_GROWTH = 0.67 // a village with a forge grows slower...
export const SOLDIER_STRENGTH = 2 // ...but its people fight as soldiers worth two
export const TOWER_RANGE = 2 // tiles it shoots and guards: only soldiers can take land there
export const TOWER_RELOAD = 1 // seconds between volleys
export const TOWER_VOLLEY = 0.1 // share of the squad a volley takes, at least one person

export const START_LAND_RADIUS = 2
export const CAPTURE_LAND_RADIUS = 1 // a captured village claims the tiles right around it

export function isPassable(cell: Cell): boolean {
  return MOVE_COST[cell.terrain] < Infinity
}
