import { type Hex, addHex, hexDistance, hexToPoint } from '../core/hex'
import { type Random, createRandom, pick, randomInt } from '../core/rng'
import { GameMap } from './map'
import { findPath } from './pathfind'
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  NEUTRAL_GARRISON,
  NEUTRAL_PAIRS,
  START_LAND_RADIUS,
  START_POPULATION,
  isPassable,
} from './rules'
import { claimAround } from './territory'
import { type Cell, HUMAN, type Owner, RIVAL, type Terrain, type Village, type World } from './world'

const UP_LEFT: Hex = { q: 0, r: -1 }
const UP_RIGHT: Hex = { q: 1, r: -1 }
const MIN_VILLAGE_GAP = 3

// Some random maps are unplayable (a village walled in by mountains), so we try the next seed
export function createWorld(seed: number): World {
  for (let attempt = 0; attempt < 100; attempt++) {
    const world = tryCreateWorld(seed + attempt * 7919)
    if (world) return world
  }
  throw new Error(`No playable map near seed ${seed}`)
}

function tryCreateWorld(seed: number): World | null {
  const random = createRandom(seed)
  const map = new GameMap(MAP_WIDTH, MAP_HEIGHT)
  scatter(map, random, 'forest', 7, 2, 0.65)
  scatter(map, random, 'mountain', 4, 1, 0.5)
  carveRiver(map, random)

  // The second half of the map is the first half turned by 180°: the same land for both players
  for (const cell of map.cells.slice(0, map.cells.length / 2)) {
    map.mirror(cell).terrain = cell.terrain
  }

  const villages = placeVillages(map, random)
  if (!villages || !allReachable(map, villages)) return null
  return { map, villages, squads: [], time: 0, winner: null, nextId: villages.length }
}

// Patches of terrain around random centers
function scatter(map: GameMap, random: Random, terrain: Terrain, patches: number, maxRadius: number, density: number): void {
  for (let i = 0; i < patches; i++) {
    const center = pick(random, map.cells)
    for (const cell of map.within(center, randomInt(random, 1, maxRadius))) {
      if (random() < density) cell.terrain = terrain
    }
  }
}

// From the map center up to the top edge, wandering left and right; crossable only at fords
function carveRiver(map: GameMap, random: Random): void {
  const middleRow = (map.height - 1) / 2
  const start = map.cellAtOffset(map.rowLength(middleRow) / 2 - 1, middleRow)!
  const centerX = (hexToPoint(map.cells[0].hex, 1).x + hexToPoint(map.cells.at(-1)!.hex, 1).x) / 2

  const river: Cell[] = []
  let cell: Cell | undefined = start
  while (cell) {
    cell.terrain = 'water'
    river.push(cell)
    const offset = hexToPoint(cell.hex, 1).x - centerX
    const goLeft = offset > 1.5 ? true : offset < -1.5 ? false : random() < 0.5
    cell = map.cellAt(addHex(cell.hex, goLeft ? UP_LEFT : UP_RIGHT))
  }
  // A ford in the middle of the map, another one up the river (and its mirror down the river)
  river[0].terrain = 'ford'
  river[Math.floor(river.length / 2) + randomInt(random, 0, 1)].terrain = 'ford'
}

// Capitals face each other across the river; neutral villages come in mirrored pairs
function placeVillages(map: GameMap, random: Random): Village[] | null {
  const middleRow = (map.height - 1) / 2
  const capital = map.cellAtOffset(2, middleRow)!
  const leftBank = [...reachableFrom(map, capital, (cell) => cell.terrain !== 'water' && cell.terrain !== 'ford')]

  const spots = [capital]
  for (let tries = 0; tries < 300 && spots.length < 1 + NEUTRAL_PAIRS; tries++) {
    const spot = pick(random, leftBank)
    const others = [...spots, ...spots.map((s) => map.mirror(s)), map.mirror(spot)]
    const farEnough = others.every((other) => hexDistance(spot.hex, other.hex) >= MIN_VILLAGE_GAP)
    if (spot.terrain !== 'mountain' && farEnough) spots.push(spot)
  }
  if (spots.length < 1 + NEUTRAL_PAIRS) return null

  const villages: Village[] = []
  const addVillage = (cell: Cell, owner: Owner, population: number) => {
    const village = { id: villages.length, cell, owner, population, capital: owner !== null }
    cell.terrain = 'field'
    cell.village = village
    cell.owner = owner
    villages.push(village)
    return village
  }
  for (const [i, spot] of spots.entries()) {
    const population = i === 0 ? START_POPULATION : randomInt(random, NEUTRAL_GARRISON.min, NEUTRAL_GARRISON.max)
    addVillage(spot, i === 0 ? HUMAN : null, population)
    addVillage(map.mirror(spot), i === 0 ? RIVAL : null, population)
  }
  for (const village of villages.slice(0, 2)) claimAround(map, village, START_LAND_RADIUS)
  return villages
}

function allReachable(map: GameMap, villages: Village[]): boolean {
  const reached = reachableFrom(map, villages[0].cell, isPassable)
  if (!villages.every((village) => reached.has(village.cell))) return false
  // Villages block paths, so also check each one can actually be marched to from the capital
  return villages.slice(1).every((village) => findPath(map, villages[0].cell, village.cell) !== null)
}

function reachableFrom(map: GameMap, start: Cell, canEnter: (cell: Cell) => boolean): Set<Cell> {
  const reached = new Set([start])
  const queue = [start]
  while (queue.length > 0) {
    for (const next of map.neighbors(queue.shift()!)) {
      if (!reached.has(next) && canEnter(next)) {
        reached.add(next)
        queue.push(next)
      }
    }
  }
  return reached
}
