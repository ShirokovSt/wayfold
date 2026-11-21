import { DIFFICULTIES, type Difficulty } from './ai/rival'
import { MAX_RIVALS } from './sim/rules'
import { BEASTS, MAP_SIZES, MAP_TYPES, SEASONS, type Beasts, type MapSize, type MapType, type Season } from './sim/world'

export interface GeneratedMap {
  readonly seed: number
  readonly type: MapType
  readonly size: MapSize
  readonly season: Season
  readonly beasts: Beasts
  readonly rivals: number
}

export interface GeneratedMatch {
  readonly map: GeneratedMap
  readonly difficulty: Difficulty
}

// The option order is part of the code. Raise this version if the same code would generate a different map.
const GENERATOR_VERSION = '1'

export function encodeMapCode({ map, difficulty }: GeneratedMatch): string {
  const seed = map.seed.toString(36).toUpperCase()
  const options = [
    MAP_TYPES.indexOf(map.type), MAP_SIZES.indexOf(map.size), SEASONS.indexOf(map.season),
    BEASTS.indexOf(map.beasts), map.rivals, DIFFICULTIES.indexOf(difficulty),
  ].join('')
  return `WF${GENERATOR_VERSION}-${seed}-${options}`
}

type MapCodeResult = { match: GeneratedMatch } | { error: 'invalid' | 'version' }

export function decodeMapCode(code: string): MapCodeResult {
  const input = code.trim()
  const prefix = /^WF(\d+)-/i.exec(input)
  if (!prefix) return { error: 'invalid' }
  if (prefix[1] !== GENERATOR_VERSION) return { error: 'version' }
  const parts = /^([0-9A-Z]{1,7})-(\d{6})$/i.exec(input.slice(prefix[0].length))
  if (!parts) return { error: 'invalid' }

  const seed = Number.parseInt(parts[1], 36)
  const [typeIndex, sizeIndex, seasonIndex, beastsIndex, rivals, difficultyIndex] = Array.from(parts[2], Number)
  const type = MAP_TYPES[typeIndex]
  const size = MAP_SIZES[sizeIndex]
  const season = SEASONS[seasonIndex]
  const beasts = BEASTS[beastsIndex]
  const difficulty = DIFFICULTIES[difficultyIndex]
  if (seed > 0xffffffff || !type || !size || !season || !beasts || !difficulty || rivals < 1 || rivals > MAX_RIVALS[size]) {
    return { error: 'invalid' }
  }
  return { match: { map: { seed, type, size, season, beasts, rivals }, difficulty } }
}
