import { hexDistance } from '../core/hex'
import type { Random } from '../core/rng'
import { type Project, build, canBuild, costOf, upgradeToTown } from '../sim/economy'
import { estateBuildings, estateTiles } from '../sim/estates'
import { findPath, pathDuration } from '../sim/pathfind'
import { POPULATION_CAP } from '../sim/rules'
import { sendSquad, squadTarget } from '../sim/squads'
import { isGuarded } from '../sim/towers'
import { growthRate, strengthOf } from '../sim/villages'
import { type BuildingKind, type Cell, type PlayerId, type Village, type World, opponent } from '../sim/world'

export type Difficulty = 'easy' | 'normal' | 'hard'
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']

// How the rival plays at each difficulty: how soon and how often it moves, and how cautiously
interface Profile {
  firstMove: number // seconds before its first move
  think: number // seconds between moves, give or take a fifth
  margin: number // extra people sent on top of what the target should have on arrival
  maxGroup: number // villages that may attack one target together
  defendChance: number // how likely it notices that a village of its own is under attack
  builds: Project[]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { firstMove: 20, think: 6, margin: 6, maxGroup: 1, defendChance: 0.5, builds: ['farm'] },
  normal: { firstMove: 10, think: 3.5, margin: 4, maxGroup: 3, defendChance: 1, builds: ['farm', 'town', 'tower'] },
  hard: { firstMove: 6, think: 2, margin: 4, maxGroup: 4, defendChance: 1, builds: ['farm', 'town', 'tower'] },
}

// A simple opponent: every few seconds it makes one move — defend, capture or raid — and spends its gold
export class Rival {
  private readonly profile: Profile
  private timer: number

  constructor(
    private readonly player: PlayerId,
    private readonly random: Random,
    difficulty: Difficulty = 'normal',
  ) {
    this.profile = PROFILES[difficulty]
    this.timer = this.profile.firstMove
  }

  update(world: World, dt: number): void {
    this.timer -= dt
    if (this.timer > 0) return
    this.timer = this.profile.think * (0.8 + this.random() * 0.4)
    const noticesAttack = this.profile.defendChance >= 1 || this.random() < this.profile.defendChance
    const defended = noticesAttack && this.defend(world)
    if (!defended && !this.capture(world)) this.raid(world)
    this.develop(world)
  }

  // A farm at the capital first, then the capital becomes a town once it has a few villages, a tower at the front,
  // farms for the other villages and then second farms; it saves up for the first plan with a free spot
  private develop(world: World): void {
    const villages = this.villages(world)
    const capital = villages.find((v) => v.capital)
    const front = this.frontVillage(world)
    const farms = (village: Village) => estateBuildings(world, village, 'farm').length
    const plans: [Village, Project][] = []
    if (capital && farms(capital) === 0) plans.push([capital, 'farm'])
    if (capital && villages.length >= 3 && !capital.town) plans.push([capital, 'town'])
    if (front && estateBuildings(world, front, 'tower').length === 0) plans.push([front, 'tower'])
    for (const village of villages) if (farms(village) === 0) plans.push([village, 'farm'])
    for (const village of villages) if (farms(village) === 1) plans.push([village, 'farm'])

    for (const [village, kind] of plans.filter(([, kind]) => this.profile.builds.includes(kind))) {
      if (kind === 'town') {
        upgradeToTown(world, this.player, village)
        return
      }
      const spot = this.buildSpot(world, village, kind)
      if (!spot) continue
      if (world.gold[this.player] >= costOf(kind)) build(world, this.player, spot, kind)
      return
    }
  }

  // Towers go toward the enemy, farms close to home
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
        .filter((other) => other !== village && other.population > shortfall + this.profile.margin)
        .sort((a, b) => hexDistance(a.cell.hex, village.cell.hex) - hexDistance(b.cell.hex, village.cell.hex))[0]
      if (helper && sendSquad(world, this.player, helper, village.cell)) return true
    }
    return false
  }

  // Picks the cheapest and closest village it can surely take, sending from up to maxGroup of
  // its nearest villages together; guarded villages only with soldiers
  private capture(world: World): boolean {
    let best: { group: Village[]; to: Village; score: number } | null = null
    for (const to of world.villages) {
      if (to.owner === this.player) continue
      const guarded = isGuarded(world, to.cell, this.player)
      const senders = this.villages(world)
        .filter((from) => !guarded || from.town)
        .map((from) => ({ from, path: findPath(world.map, from.cell, to.cell) }))
        .filter((s) => s.path !== null)
        .map(({ from, path }) => ({ from, time: pathDuration(path!), strength: this.strength(from) }))
        .sort((a, b) => a.time - b.time)
        .slice(0, this.profile.maxGroup)

      let strength = 0
      for (const [i, sender] of senders.entries()) {
        strength += sender.strength
        const needed = (to.population + growthRate(world, to) * sender.time) * strengthOf(to) + this.profile.margin -
          incoming(world, to, (owner) => owner === this.player)
        const score = sender.time + needed * 0.3 + i * 3 // a lone attack is simpler, so it is preferred
        if (strength >= needed && (!best || score < best.score)) {
          best = { group: senders.slice(0, i + 1).map((s) => s.from), to, score }
          break
        }
      }
    }
    if (!best) return false
    for (const from of best.group) sendSquad(world, this.player, from, best.to.cell)
    return true
  }

  // What the village's people are worth in a fight if they all set off now
  private strength(village: Village): number {
    return Math.floor(village.population) * strengthOf(village)
  }

  // A full village with nothing to take marches over the nearest enemy land and back:
  // soldiers go for enemy towers first, peasants only where land is not guarded
  private raid(world: World): boolean {
    const full = this.villages(world).find((village) => village.population >= POPULATION_CAP * 0.8)
    if (!full) return false
    const soldiers = full.town
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
