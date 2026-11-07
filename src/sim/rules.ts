import type { Cell, Terrain } from './world'

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
export const CLASH_DISTANCE = 0.7 // enemy squads closer than this (in tiles) fight

export const START_POPULATION = 10
export const NEUTRAL_GARRISON = { min: 5, max: 12 }
export const POPULATION_CAP = 50 // villages stop growing here, but can be reinforced above it

// A village grows by BASE_GROWTH + GROWTH_PER_TILE for each own tile within LAND_RADIUS, per second
export const BASE_GROWTH = 0.25
export const GROWTH_PER_TILE = 0.05
export const LAND_RADIUS = 2

export const START_LAND_RADIUS = 2
export const CAPTURE_LAND_RADIUS = 1 // a captured village claims the tiles right around it

export function isPassable(cell: Cell): boolean {
  return MOVE_COST[cell.terrain] < Infinity
}
