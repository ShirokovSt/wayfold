import type { BuildingKind, Cell, MapSize, Season, Terrain } from './world'

// All the balance numbers in one place

export const TICK_SECONDS = 1 / 20

// Map sizes in tiles; heights are odd, so every map has a middle row
export const MAP_DIMENSIONS: Record<MapSize, { width: number; height: number }> = {
  small: { width: 17, height: 11 },
  medium: { width: 23, height: 15 },
  large: { width: 29, height: 19 },
}
export const MAX_RIVALS: Record<MapSize, number> = { small: 1, medium: 2, large: 3 } // bigger maps hold more players
export const LAND_PER_VILLAGE = 22 // roughly one village for this many land tiles...
export const VILLAGE_PAIRS = { min: 3, max: 7 } // ...but from 6 to 14 villages in all

// How many summer field tiles a step onto this terrain is worth; Infinity is impassable.
// Autumn mud slows fields, winter snow slows everything, spring floods slow the fords
const SUMMER_COST: Record<Terrain, number> = { field: 1, forest: 2, ford: 1.6, ice: 1.6, mountain: Infinity, water: Infinity }
const MOVE_COST: Record<Season, Record<Terrain, number>> = {
  summer: SUMMER_COST,
  autumn: { ...SUMMER_COST, field: 1.3 },
  winter: { ...SUMMER_COST, field: 1.4, forest: 2.5 },
  spring: { ...SUMMER_COST, ford: 3 },
}

export function moveCost(season: Season, terrain: Terrain): number {
  return MOVE_COST[season][terrain]
}

export const SEASON_GROWTH: Record<Season, number> = { summer: 1, autumn: 1, winter: 0.7, spring: 1.25 }
export const HARVEST_GOLD = 0.5 // in autumn every farm also brings this much gold per second

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

export const BUILDING_COST: Record<BuildingKind, number> = { farm: 30, tower: 45 }
export const SELL_SHARE = 0.5 // a building torn down gives back this share of its price
export const CLEAR_COST = 15 // cutting down an own forest: half a farm, so a farm there costs as much as a tower
export const FARM_GROWTH = 0.25 // extra people per second for the village whose estate has the farm
export const TOWN_COST = 60 // a village upgraded to a town...
export const TOWN_GROWTH = 0.67 // ...grows slower...
export const SOLDIER_STRENGTH = 2 // ...but its people fight as soldiers worth two, attacking and defending
export const TOWER_RANGE = 2 // tiles it shoots and guards: only soldiers can take land there
export const TOWER_RELOAD = 1 // seconds between volleys
export const TOWER_VOLLEY = 0.1 // share of the squad a volley takes, at least one person

// Wolves: dens in mirrored pairs, wild land around them, raids now and then
export const LAIR_COUNT: Record<MapSize, Record<'few' | 'many', number>> = {
  small: { few: 2, many: 4 },
  medium: { few: 4, many: 6 },
  large: { few: 6, many: 10 },
}
export const LAIR_GAP = 4 // tiles from any village, so the wild land never touches one
export const PACK_SIZE = { min: 14, max: 22 } // wolves in a den at the start, and the most it holds
export const PACK_GROWTH = 0.05 // wolves per second a den grows back
export const WILD_RADIUS = 1
export const WILD_PATH_COST = 2 // routes go around wild land: a step there counts this much extra
export const WILD_BITE = 1.5 // seconds between bites at squads in the wild land...
export const WILD_BITE_SHARE = 0.1 // ...each taking this share of the squad, at least one person
export const LAIR_BOUNTY = 40 // gold for clearing a den
export const RAID_EVERY: Record<Season, number> = { summer: 90, autumn: 65, winter: 40, spring: 65 } // give or take a third
export const RAID_SIZE = { min: 3, max: 8 } // up to half the den goes
export const PACK_SPEED = 1.2 // field tiles per second: wolves are a bit quicker than people

export const START_LAND_RADIUS = 2
export const CAPTURE_LAND_RADIUS = 1 // a captured village claims the tiles right around it

export function isPassable(cell: Cell): boolean {
  return cell.terrain !== 'mountain' && cell.terrain !== 'water'
}

// Walkable tiles that can be owned: everything walkable but winter ice
export function isLand(cell: Cell): boolean {
  return isPassable(cell) && cell.terrain !== 'ice'
}
