import { hexDistance } from '../core/hex'
import type { Random } from '../core/rng'
import { build, canBuild } from '../sim/economy'
import { estateBuildings, estateTiles } from '../sim/estates'
import { findPath, pathDuration } from '../sim/pathfind'
import { BUILDING_COST, POPULATION_CAP, SOLDIER_STRENGTH } from '../sim/rules'
import { sendSquad, squadTarget } from '../sim/squads'
import { isGuarded } from '../sim/towers'
import { growthRate, hasForge } from '../sim/villages'
import { type BuildingKind, type Cell, type PlayerId, type Village, type World, opponent } from '../sim/world'

// How the rival plays: how soon and how often it moves, and how cautiously
const FIRST_MOVE_SECONDS = 10
const THINK_SECONDS = 3.5
const SAFETY_MARGIN = 4 // extra people sent on top of what the target should have on arrival

// A simple opponent: every few seconds it makes one move — defend, capture or raid — and spends its gold
export class Rival {
  private timer = FIRST_MOVE_SECONDS

  constructor(
    private readonly player: PlayerId,
    private readonly random: Random,
  ) {}

  update(world: World, dt: number): void {
    this.timer -= dt
    if (this.timer > 0) return
    this.timer = THINK_SECONDS * (0.8 + this.random() * 0.4)
    this.defend(world) || this.capture(world) || this.raid(world)
    this.develop(world)
  }

  // A farm at the capital first, then a forge there once it has a few villages, a tower at the front,
  // farms for the other villages and then second farms; it saves up for the first plan with a free spot
  private develop(world: World): void {
    const villages = this.villages(world)
    const capital = villages.find((v) => v.capital)
    const front = this.frontVillage(world)
    const farms = (village: Village) => estateBuildings(world, village, 'farm').length
    const plans: [Village, BuildingKind][] = []
    if (capital && farms(capital) === 0) plans.push([capital, 'farm'])
    if (capital && villages.length >= 3 && !hasForge(world, capital)) plans.push([capital, 'forge'])
    if (front && estateBuildings(world, front, 'tower').length === 0) plans.push([front, 'tower'])
    for (const village of villages) if (farms(village) === 0) plans.push([village, 'farm'])
    for (const village of villages) if (farms(village) === 1) plans.push([village, 'farm'])

    for (const [village, kind] of plans) {
      const spot = this.buildSpot(world, village, kind)
      if (!spot) continue
      if (world.gold[this.player] >= BUILDING_COST[kind]) build(world, this.player, spot, kind)
      return
    }
  }

  // Towers go toward the enemy, farms and forges close to home
  private buildSpot(world: World, village: Village, kind: BuildingKind): Cell | null {
    const spots = estateTiles(world, village).filter((cell) => canBuild(world, this.player, cell, kind))
    const enemy = this.enemyVillages(world)
    const score = (cell: Cell) =>
      kind === 'tower' && enemy.length > 0
        ? Math.min(...enemy.map((e) => hexDistance(e.cell.hex, cell.hex)))
        : hexDistance(village.cell.hex, cell.hex)
    return spots.sort((a, b) => score(a) - score(b))[0] ?? null
  }

  // The own village closest to the enemy
  private frontVillage(world: World): Village | null {
    const enemy = this.enemyVillages(world)
    if (enemy.length === 0) return null
    const distance = (village: Village) => Math.min(...enemy.map((e) => hexDistance(e.cell.hex, village.cell.hex)))
    return this.villages(world).sort((a, b) => distance(a) - distance(b))[0] ?? null
  }

  private enemyVillages(world: World): Village[] {
    return world.villages.filter((village) => village.owner === opponent(this.player))
  }

  // Sends help to a village that an enemy squad is about to take
  private defend(world: World): boolean {
    for (const village of this.villages(world)) {
      const shortfall = incoming(world, village, (owner) => owner !== this.player) - village.population -
        incoming(world, village, (owner) => owner === this.player)
      if (shortfall <= 0) continue
      const helper = this.villages(world)
        .filter((other) => other !== village && other.population > shortfall + SAFETY_MARGIN)
        .sort((a, b) => hexDistance(a.cell.hex, village.cell.hex) - hexDistance(b.cell.hex, village.cell.hex))[0]
      if (helper && sendSquad(world, this.player, helper, village.cell)) return true
    }
    return false
  }

  // Picks the cheapest and closest village it can surely take; guarded ones only with soldiers
  private capture(world: World): boolean {
    let best: { from: Village; to: Village; score: number } | null = null
    for (const from of this.villages(world)) {
      const soldiers = hasForge(world, from)
      for (const to of world.villages) {
        if (to.owner === this.player || (!soldiers && isGuarded(world, to.cell, this.player))) continue
        const path = findPath(world.map, from.cell, to.cell)
        if (!path) continue
        const time = pathDuration(path)
        const needed = to.population + growthRate(world, to) * time + SAFETY_MARGIN -
          incoming(world, to, (owner) => owner === this.player)
        const strength = from.population * (soldiers ? SOLDIER_STRENGTH : 1)
        const score = time + needed * 0.3
        if (strength >= needed && (!best || score < best.score)) best = { from, to, score }
      }
    }
    return best !== null && sendSquad(world, this.player, best.from, best.to.cell) !== null
  }

  // A full village with nothing to take marches over the nearest enemy land and back:
  // soldiers go for enemy towers first, peasants only where land is not guarded
  private raid(world: World): boolean {
    const full = this.villages(world).find((village) => village.population >= POPULATION_CAP * 0.8)
    if (!full) return false
    const soldiers = hasForge(world, full)
    const enemyLand = world.map.cells.filter((cell) => cell.owner !== null && cell.owner !== this.player && !cell.village)
    const towers = enemyLand.filter((cell) => cell.building?.kind === 'tower')
    const open = enemyLand.filter((cell) => !isGuarded(world, cell, this.player))
    const target = nearest(soldiers && towers.length > 0 ? towers : soldiers ? enemyLand : open, full.cell)
    return target !== null && sendSquad(world, this.player, full, target) !== null
  }

  private villages(world: World): Village[] {
    return world.villages.filter((village) => village.owner === this.player)
  }
}

// People in squads heading to the village whose owner matches
function incoming(world: World, village: Village, matches: (owner: PlayerId) => boolean): number {
  let count = 0
  for (const squad of world.squads) {
    if (squadTarget(squad) === village.cell && matches(squad.owner)) count += squad.count
  }
  return count
}

function nearest(cells: Cell[], to: Cell): Cell | null {
  let best: Cell | null = null
  for (const cell of cells) {
    if (!best || hexDistance(cell.hex, to.hex) < hexDistance(best.hex, to.hex)) best = cell
  }
  return best
}
