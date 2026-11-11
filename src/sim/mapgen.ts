import { type Hex, addHex, hexDistance, hexLine, hexToPoint } from '../core/hex'
import { createNoise } from '../core/noise'
import { type Random, createRandom, pick, randomInt } from '../core/rng'
import { makeLair } from './beasts'
import { GameMap } from './map'
import { findPath } from './pathfind'
import {
  LAIR_COUNT,
  LAIR_GAP,
  LAND_PER_VILLAGE,
  MAP_DIMENSIONS,
  NEUTRAL_GARRISON,
  PACK_SIZE,
  START_LAND_RADIUS,
  START_POPULATION,
  VILLAGE_PAIRS,
  isPassable,
} from './rules'
import { claimAround } from './territory'
import {
  type Beasts,
  type Cell,
  HUMAN,
  type Lair,
  MAP_TYPES,
  type MapSize,
  type MapType,
  type Owner,
  RIVAL,
  SEASONS,
  type Season,
  type Village,
  type World,
  newWorld,
} from './world'

export interface MapSettings {
  size: MapSize
  type: MapType | 'random'
  season?: Season | 'random' // summer when left out
  beasts?: Beasts // none when left out
}

export const DEFAULT_SETTINGS: MapSettings = { size: 'medium', type: 'random', season: 'random', beasts: 'few' }

// Each map type is a share of land and a "bias" that raises or lowers the land by position:
// u and v go from -1 to 1 across the map, the players start near u = -0.7 and u = 0.7
// Heights are 2 × noise + bias, so a bias of about 1 decides the shape and less only nudges it
const SHAPES: Record<MapType, { land: number; detail: number; bias: (u: number, v: number) => number }> = {
  continent: { land: 0.86, detail: 0.12, bias: (u, v) => -1.2 * edge(u, v) },
  lakes: { land: 0.78, detail: 0.2, bias: (u, v) => -0.3 * edge(u, v) },
  peninsulas: { land: 0.56, detail: 0.14, bias: (u, v) => 1.4 * Math.abs(u) - 1.1 * v * v - edge(0, v) },
  islands: { land: 0.45, detail: 0.3, bias: (u, v) => -0.5 * edge(u, v) },
}

const UP_LEFT: Hex = { q: 0, r: -1 }
const UP_RIGHT: Hex = { q: 1, r: -1 }
const MIN_VILLAGE_GAP = 3
const MIN_CAPITAL_GAP = 6
const SMALLEST_ISLAND = 4 // smaller bits of land sink back into the sea

// Some random maps are unplayable (a village walled in by mountains), so we try the next seed
export function createWorld(seed: number, settings: MapSettings = DEFAULT_SETTINGS): World {
  const type = settings.type === 'random' ? pick(createRandom(seed), MAP_TYPES) : settings.type
  const season = settings.season === 'random' ? pick(createRandom(seed + 1), SEASONS) : (settings.season ?? 'summer')
  for (let attempt = 0; attempt < 100; attempt++) {
    const world = tryCreateWorld(seed + attempt * 7919, settings.size, type, season, settings.beasts ?? 'none')
    if (world) return world
  }
  throw new Error(`No playable map near seed ${seed}`)
}

function tryCreateWorld(seed: number, size: MapSize, type: MapType, season: Season, beasts: Beasts): World | null {
  const random = createRandom(seed)
  const { width, height } = MAP_DIMENSIONS[size]
  const map = new GameMap(width, height)
  raiseLand(map, random, SHAPES[type])
  const river = type === 'continent' ? carveRiver(map, random) : []

  // The second half of the map is the first half turned by 180°: the same land for both players
  for (const cell of map.cells.slice(0, map.cells.length / 2)) map.mirror(cell).terrain = cell.terrain
  connectLand(map)

  const villages = placeVillages(map, random)
  if (!villages || !allReachable(map, villages)) return null
  // Dens have their own random numbers, so turning beasts on or off leaves the rest of the map as it was
  const lairs = beasts === 'none' ? [] : placeLairs(map, villages, LAIR_COUNT[size][beasts], createRandom(seed + 104729))
  // The season comes last, so the same seed gives the same map in every season
  map.season = season
  if (season === 'winter') freezeInlandWater(map, [...river, ...river.map((cell) => map.mirror(cell))])
  return newWorld(map, villages, type, lairs)
}

// Wolves' dens in mirrored pairs, away from the villages and from each other, preferably in the woods.
// On a crowded map a den may stand closer to a neutral village, never to a capital:
// the wild land must stay off the land the players start with
function placeLairs(map: GameMap, villages: Village[], count: number, random: Random): Lair[] {
  const lairs: Lair[] = []
  const land = shuffle(map.cells.filter((cell) => (cell.terrain === 'field' || cell.terrain === 'forest') && !cell.village), random)
  const farEnough = (cell: Cell, gap: number) =>
    villages.every((village) => hexDistance(village.cell.hex, cell.hex) >= (village.capital ? LAIR_GAP : gap)) &&
    lairs.every((lair) => hexDistance(lair.cell.hex, cell.hex) >= 3) &&
    hexDistance(cell.hex, map.mirror(cell).hex) >= 3
  const findSpot = (gap: number) =>
    land
      .filter((cell) => !cell.lair && farEnough(cell, gap))
      .sort((a, b) => Number(b.terrain === 'forest') - Number(a.terrain === 'forest'))
      .slice(0, 30) // enough tries; checking every tile for blocked ways would be slow
      .find((cell) => findPath(map, villages[0].cell, cell) !== null && !blocksWay(map, villages, cell))
  for (let pair = 0; pair < count / 2; pair++) {
    const spot = findSpot(LAIR_GAP) ?? findSpot(LAIR_GAP - 1) ?? findSpot(LAIR_GAP - 2)
    if (!spot) break
    const size = randomInt(random, PACK_SIZE.min, PACK_SIZE.max)
    lairs.push(makeLair(map, spot, pair, size), makeLair(map, map.mirror(spot), pair, size))
  }
  return lairs
}

// Rivers and lakes freeze over, the sea does not: lakes are water that does not reach the map edge
function freezeInlandWater(map: GameMap, river: Cell[]): void {
  const frozen = new Set(river)
  const seen = new Set<Cell>()
  for (const start of map.cells) {
    if (seen.has(start) || start.terrain !== 'water') continue
    const body = [start]
    seen.add(start)
    for (let i = 0; i < body.length; i++) {
      for (const next of map.neighbors(body[i])) {
        if (!seen.has(next) && next.terrain === 'water') {
          seen.add(next)
          body.push(next)
        }
      }
    }
    if (!body.some((cell) => map.neighbors(cell).length < 6)) for (const cell of body) frozen.add(cell)
  }
  for (const cell of frozen) if (cell.terrain === 'water') cell.terrain = 'ice'
}

// Heights from noise plus the map type's bias; the lowest part becomes sea, the highest mountains
function raiseLand(map: GameMap, random: Random, shape: (typeof SHAPES)[MapType]): void {
  const heightNoise = createNoise(random)
  const forestNoise = createNoise(random)
  const center = mapCenter(map)
  const heights = map.cells.map((cell) => {
    const { x, y } = hexToPoint(cell.hex, 1)
    return 2 * heightNoise(x * shape.detail, y * shape.detail) + shape.bias(x / center.x - 1, y / center.y - 1)
  })
  const seaLevel = quantile(heights, 1 - shape.land)
  const mountainLevel = quantile(heights.filter((h) => h >= seaLevel), 0.93)

  map.cells.forEach((cell, i) => {
    const { x, y } = hexToPoint(cell.hex, 1)
    if (heights[i] < seaLevel) cell.terrain = 'water'
    else if (heights[i] >= mountainLevel) cell.terrain = 'mountain'
    else cell.terrain = forestNoise(x * 0.25 + 40, y * 0.25) > 0.58 ? 'forest' : 'field'
  })
}

// On the mainland, a river from the map center up to the top edge, crossable only at fords
function carveRiver(map: GameMap, random: Random): Cell[] {
  const middleRow = (map.height - 1) / 2
  const start = map.cellAtOffset(map.rowLength(middleRow) / 2 - 1, middleRow)!
  const centerX = mapCenter(map).x

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
  return river
}

// Every piece of land must be reachable: tiny islands sink, bigger ones get a line of fords
// to the largest landmass; changes are mirrored to keep the map fair
function connectLand(map: GameMap): void {
  const set = (cell: Cell, terrain: Cell['terrain']) => {
    cell.terrain = terrain
    map.mirror(cell).terrain = terrain
  }
  for (let round = 0; round < 50; round++) {
    const pieces = landPieces(map).sort((a, b) => b.length - a.length)
    if (pieces.length <= 1) return
    const piece = pieces[pieces.length - 1]
    if (piece.length < SMALLEST_ISLAND) {
      for (const cell of piece) set(cell, 'water')
      continue
    }
    const [from, to] = closestPair(piece, pieces[0])
    for (const hex of hexLine(from.hex, to.hex)) {
      const cell = map.cellAt(hex)!
      if (cell.terrain === 'water') set(cell, 'ford')
      else if (cell.terrain === 'mountain') set(cell, 'field')
    }
  }
}

// Capitals face each other from the left and the right; neutral villages come in mirrored pairs,
// spread out as far from each other as the land allows
function placeVillages(map: GameMap, random: Random): Village[] | null {
  const center = mapCenter(map)
  const land = map.cells.filter((cell) => cell.terrain === 'field' || cell.terrain === 'forest')
  const pairs = Math.min(VILLAGE_PAIRS.max, Math.max(VILLAGE_PAIRS.min, Math.round(land.length / LAND_PER_VILLAGE / 2)))

  const capitalScore = (cell: Cell) => {
    const { x, y } = hexToPoint(cell.hex, 1)
    return Math.abs(x / center.x - 1 + 0.7) + 0.5 * Math.abs(y / center.y - 1)
  }
  const capital = land
    .filter((cell) => hexDistance(cell.hex, map.mirror(cell).hex) >= MIN_CAPITAL_GAP)
    .sort((a, b) => capitalScore(a) - capitalScore(b))[0]
  if (!capital) return null

  const spots = [capital]
  const taken = () => [...spots, ...spots.map((s) => map.mirror(s))]
  const gap = (cell: Cell) => Math.min(...[...taken(), map.mirror(cell)].map((other) => hexDistance(cell.hex, other.hex)))
  while (spots.length < pairs) {
    const candidates = Array.from({ length: 30 }, () => pick(random, land)).filter((cell) => gap(cell) >= MIN_VILLAGE_GAP)
    if (candidates.length === 0) return null
    spots.push(candidates.sort((a, b) => gap(b) - gap(a))[0])
  }

  const villages: Village[] = []
  const addVillage = (cell: Cell, owner: Owner, population: number) => {
    const village = { id: villages.length, cell, owner, population, capital: owner !== null, town: false, capturedAt: 0 }
    cell.terrain = 'field'
    cell.village = village
    cell.owner = owner
    villages.push(village)
  }
  for (const [i, spot] of spots.entries()) {
    const population = i === 0 ? START_POPULATION : randomInt(random, NEUTRAL_GARRISON.min, NEUTRAL_GARRISON.max)
    addVillage(spot, i === 0 ? HUMAN : null, population)
    addVillage(map.mirror(spot), i === 0 ? RIVAL : null, population)
  }
  for (const village of villages.slice(0, 2)) claimAround(map, village, START_LAND_RADIUS)
  return villages
}

// The same cells in a random order (Fisher–Yates)
function shuffle<T>(items: T[], random: Random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(random, 0, i)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

// A den is in the way like a village: it must not stand in the only pass to a village
function blocksWay(map: GameMap, villages: Village[], cell: Cell): boolean {
  const spots = [cell, map.mirror(cell)]
  for (const spot of spots) spot.village = villages[0] // just for the check: something paths go around
  const blocked = !allReachable(map, villages)
  for (const spot of spots) spot.village = null
  return blocked
}

// Villages block paths, so check each one can actually be marched to from the capital
function allReachable(map: GameMap, villages: Village[]): boolean {
  return villages.slice(1).every((village) => findPath(map, villages[0].cell, village.cell) !== null)
}

// Groups of walkable tiles that touch each other
function landPieces(map: GameMap): Cell[][] {
  const seen = new Set<Cell>()
  const pieces: Cell[][] = []
  for (const start of map.cells) {
    if (seen.has(start) || !isPassable(start)) continue
    const piece = [start]
    seen.add(start)
    for (let i = 0; i < piece.length; i++) {
      for (const next of map.neighbors(piece[i])) {
        if (!seen.has(next) && isPassable(next)) {
          seen.add(next)
          piece.push(next)
        }
      }
    }
    pieces.push(piece)
  }
  return pieces
}

function closestPair(a: Cell[], b: Cell[]): [Cell, Cell] {
  let best: [Cell, Cell] = [a[0], b[0]]
  let bestDistance = Infinity
  for (const x of a) {
    for (const y of b) {
      const distance = hexDistance(x.hex, y.hex)
      if (distance < bestDistance) {
        best = [x, y]
        bestDistance = distance
      }
    }
  }
  return best
}

// The middle of the map in hex radii; the first cell is at (0, 0)
function mapCenter(map: GameMap): { x: number; y: number } {
  const last = hexToPoint(map.cells[map.cells.length - 1].hex, 1)
  return { x: last.x / 2, y: last.y / 2 }
}

// How strongly the map edge pulls the land down: 0 inside, 1 at the very edge
function edge(u: number, v: number): number {
  const t = Math.min(1, Math.max(0, (Math.max(Math.abs(u), Math.abs(v)) - 0.65) / 0.35))
  return t * t * (3 - 2 * t)
}

// The value below which the given share of the values lies
function quantile(values: number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(share * sorted.length)))]
}
