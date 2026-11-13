import { hexDistance } from '../core/hex'
import { currentLanguage, t } from '../i18n'
import { estateTiles, estateVillage } from '../sim/estates'
import { ESTATE_RADIUS, FARM_GROWTH, GOLD_PER_TILE, HARVEST_GOLD, POPULATION_CAP, SEASON_GROWTH, TOWN_GROWTH } from '../sim/rules'
import { isGuarded } from '../sim/towers'
import { growthRate, strengthOf } from '../sim/villages'
import { type Cell, HUMAN, type Lair, type Owner, type Village, type World } from '../sim/world'
import type { IconName } from './icons'

export interface Item {
  icon?: IconName
  text: string
}

// What the card above a tile says: whose it is, what it is, and a few short rows
export interface TileInfo {
  owner: Owner | 'wild'
  title: string
  kind: string
  rows: Item[][]
}

export function villageName(village: Village): string {
  return t().villageName(village.name)
}

// The village a tile is shown with: the one on it, or the one whose estate the tile is in
export function linkedVillage(world: World, cell: Cell): Village | null {
  return cell.village ?? estateOf(world, cell)
}

export function describeTile(world: World, cell: Cell): TileInfo | null {
  if (cell.lair) return describeLair(cell.lair)
  if (cell.village) return describeVillage(world, cell.village)
  if (cell.building) return describeBuilding(world, cell)
  return null
}

// Over the build menu of an empty own tile: which village a farm there would feed
export function describeEstate(world: World, cell: Cell): TileInfo | null {
  const village = estateOf(world, cell)
  return village && { owner: village.owner, title: villageName(village), kind: t().estate, rows: [] }
}

function describeLair(lair: Lair): TileInfo {
  const strings = t()
  return {
    owner: 'wild', title: strings.lairName, kind: '',
    rows: [[{ text: `${strings.lairPack}: ${Math.floor(lair.pack)}` }], [{ text: strings.lairBounty }]],
  }
}

function describeVillage(world: World, village: Village): TileInfo {
  const strings = t()
  const people = Math.floor(village.population)
  const rows: Item[][] = []
  if (village.owner === null) {
    rows.push([{ icon: 'people', text: String(people) }, { text: strings.notGrowing }])
  } else {
    // A full village stands still, but the rate tells how fast it fills up again
    const paused = village.population >= POPULATION_CAP ? ` ${strings.paused}` : ''
    const growth = `+${decimal(growthRate(world, village))}${strings.perSecond}${paused}`
    rows.push([{ icon: 'people', text: `${people}/${POPULATION_CAP}` }, { text: growth }])
    const tiles = estateTiles(world, village)
    const count = (kind: string) => tiles.filter((cell) => cell.building?.kind === kind).length
    // The village's own tile brings gold too
    const harvest = world.map.season === 'autumn' ? HARVEST_GOLD * count('farm') : 0
    const gold = GOLD_PER_TILE * (tiles.length + 1) + harvest
    // A rival's gold is none of your business, here as in the top bar
    const income = village.owner === HUMAN ? [{ icon: 'gold' as const, text: `+${decimal(gold)}${strings.perSecond}` }] : []
    rows.push([
      { icon: 'farm', text: String(count('farm')) },
      { icon: 'tower', text: String(count('tower')) },
      { icon: 'land', text: String(tiles.length) },
      ...income,
    ])
    if (village.town) rows.push([{ text: strings.soldiersHere }])
  }
  if (village.owner !== HUMAN) {
    rows.push([{ text: strings.defence(Math.floor(village.population * strengthOf(village))) }])
    if (isGuarded(world, village.cell, HUMAN)) rows.push([{ text: strings.guardedHere }])
  }
  const kinds = strings.villageKinds
  const kind = village.capital || village.town
    ? [village.capital && kinds.capital, village.town && kinds.town].filter(Boolean).join(', ')
    : kinds.village
  const whose = village.owner === null ? strings.nobodysVillage : `${strings.players[village.owner]} · ${kind}`
  return { owner: village.owner, title: villageName(village), kind: whose, rows }
}

function describeBuilding(world: World, cell: Cell): TileInfo {
  const strings = t()
  const kind = cell.building!.kind
  const village = estateOf(world, cell)
  const rows: Item[][] = []
  if (village) rows.push([{ text: `${strings.estate}: ${villageName(village)}` }])
  if (kind === 'farm') {
    const people = FARM_GROWTH * SEASON_GROWTH[world.map.season] * (village?.town ? TOWN_GROWTH : 1)
    rows.push([{ text: village ? strings.farmPeople(decimal(people)) : strings.farOff }])
    const autumn = world.map.season === 'autumn'
    rows.push([{ text: autumn ? strings.harvestNow(decimal(HARVEST_GOLD)) : strings.harvestLater }])
  } else {
    rows.push([{ text: strings.towerShot }], [{ text: strings.towerGuard }])
  }
  const whose = cell.owner === null ? strings.nobodys : strings.players[cell.owner]
  return { owner: cell.owner, title: strings.buildings[kind], kind: whose, rows }
}

// The village whose estate the tile is in, as growth counts it: the nearest own village within ESTATE_RADIUS
function estateOf(world: World, cell: Cell): Village | null {
  const village = estateVillage(world, cell)
  return village && hexDistance(village.cell.hex, cell.hex) <= ESTATE_RADIUS ? village : null
}

// 0.25 or 1.3, with the decimal mark of the language
function decimal(value: number): string {
  return value.toLocaleString(currentLanguage(), { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}
