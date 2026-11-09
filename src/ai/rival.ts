import { hexDistance } from '../core/hex'
import type { Random } from '../core/rng'
import { type Project, build, canBuild, costOf, upgradeToTown } from '../sim/economy'
import { estateBuildings, estateTiles } from '../sim/estates'
import { findPath, pathDuration } from '../sim/pathfind'
import { POPULATION_CAP } from '../sim/rules'
import { type Share, sendSquad, squadCell, squadSize, squadTarget } from '../sim/squads'
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
  watch: Watch
  builds: Project[]
}

// Which enemy squads a village keeps a garrison against: none (it sends everyone),
// those heading for it, or also those passing close by, which could turn to it
type Watch = 'none' | 'aimed' | 'nearby'
const NEARBY = 3 // tiles

// Like the player, the rival sends either half of a village's people or all of them
interface Sender {
  from: Village
  time: number // seconds to the target
  shares: Share[] // what it may send and still keep its garrison, smaller first
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { firstMove: 20, think: 6, margin: 6, maxGroup: 1, defendChance: 0.5, watch: 'none', builds: ['farm'] },
  normal: { firstMove: 10, think: 3.5, margin: 4, maxGroup: 3, defendChance: 1, watch: 'aimed', builds: ['farm', 'town', 'tower'] },
  hard: { firstMove: 6, think: 2, margin: 4, maxGroup: 4, defendChance: 1, watch: 'nearby', builds: ['farm', 'town', 'tower'] },
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
      const shortfall = this.threat(world, village, false) - village.population * strengthOf(village) -
        incoming(world, village, (owner) => owner === this.player)
      if (shortfall <= 0) continue
      const needed = shortfall + this.profile.margin
      const helpers = this.villages(world)
        .filter((other) => other !== village)
        .sort((a, b) => hexDistance(a.cell.hex, village.cell.hex) - hexDistance(b.cell.hex, village.cell.hex))
      for (const helper of helpers) {
        const share = this.shares(world, helper).find((share) => this.power(helper, share) >= needed)
        if (share && sendSquad(world, this.player, helper, village.cell, share)) return true
      }
    }
    return false
  }

  // Picks the cheapest and closest village it can surely take, sending from up to maxGroup of
  // its nearest villages together; guarded villages only with soldiers. Each sender sends all it may,
  // then the group sends halves wherever the rest is still enough
  private capture(world: World): boolean {
    let best: { group: Sender[]; shares: Share[]; to: Village; score: number } | null = null
    for (const to of world.villages) {
      if (to.owner === this.player) continue
      const guarded = isGuarded(world, to.cell, this.player)
      const senders: Sender[] = this.villages(world)
        .filter((from) => !guarded || from.town)
        .map((from) => ({ from, path: findPath(world.map, from.cell, to.cell) }))
        .filter((s) => s.path !== null)
        .map(({ from, path }) => ({ from, time: pathDuration(world.map, path!), shares: this.shares(world, from) }))
        .filter((s) => s.shares.length > 0)
        .sort((a, b) => a.time - b.time)
        .slice(0, this.profile.maxGroup)

      let strength = 0
      for (const [i, sender] of senders.entries()) {
        strength += this.power(sender.from, sender.shares[sender.shares.length - 1])
        const needed = (to.population + growthRate(world, to) * sender.time) * strengthOf(to) + this.profile.margin -
          incoming(world, to, (owner) => owner === this.player)
        const score = sender.time + needed * 0.3 + i * 3 // a lone attack is simpler, so it is preferred
        if (strength >= needed && (!best || score < best.score)) {
          const group = senders.slice(0, i + 1)
          best = { group, shares: this.smallestShares(group, needed), to, score }
          break
        }
      }
    }
    if (!best) return false
    best.group.forEach((sender, i) => sendSquad(world, this.player, sender.from, best.to.cell, best.shares[i]))
    return true
  }

  // Starts with everyone the group may send, then sends half instead wherever the attack stays strong enough
  private smallestShares(group: Sender[], needed: number): Share[] {
    const shares = group.map((sender) => sender.shares[sender.shares.length - 1])
    let total = group.reduce((sum, sender, i) => sum + this.power(sender.from, shares[i]), 0)
    group.forEach((sender, i) => {
      if (shares[i] === 'half' || !sender.shares.includes('half')) return
      const saved = this.power(sender.from, 'all') - this.power(sender.from, 'half')
      if (total - saved >= needed) {
        shares[i] = 'half'
        total -= saved
      }
    })
    return shares
  }

  // What the village may send and still keep its garrison home; an easy rival only ever sends everyone
  private shares(world: World, village: Village): Share[] {
    const people = Math.floor(village.population)
    const options: Share[] = this.profile.watch === 'none' ? ['all'] : ['half', 'all']
    const garrison = this.garrison(world, village)
    return options.filter((share) => {
      const count = squadSize(people, share)
      return count >= 1 && people - count >= garrison
    })
  }

  // People who stay home to hold the village against the enemy squads it watches
  private garrison(world: World, village: Village): number {
    if (this.profile.watch === 'none') return 0
    const threat = this.threat(world, village, this.profile.watch === 'nearby')
    return threat > 0 ? Math.ceil(threat / strengthOf(village)) + 1 : 0
  }

  // The strength of enemy squads heading for the village, and if asked, of those passing close by
  private threat(world: World, village: Village, nearby: boolean): number {
    let power = 0
    for (const squad of world.squads) {
      if (squad.owner === this.player) continue
      const aimed = squadTarget(squad) === village.cell
      const close = nearby && hexDistance(squadCell(squad).hex, village.cell.hex) <= NEARBY
      if (aimed || close) power += squad.count * squad.strength
    }
    return power
  }

  // What a squad of this share is worth in a fight
  private power(village: Village, share: Share): number {
    return squadSize(village.population, share) * strengthOf(village)
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
    const share = this.shares(world, full)[0]
    return target !== null && share !== undefined && sendSquad(world, this.player, full, target, share) !== null
  }

  private villages(world: World): Village[] {
    return world.villages.filter((village) => village.owner === this.player)
  }
}

// The strength of squads heading to the village whose owner matches
function incoming(world: World, village: Village, matches: (owner: PlayerId) => boolean): number {
  let power = 0
  for (const squad of world.squads) {
    if (squadTarget(squad) === village.cell && matches(squad.owner)) power += squad.count * squad.strength
  }
  return power
}

function nearest(cells: Cell[], to: Cell): Cell | null {
  let best: Cell | null = null
  for (const cell of cells) {
    if (!best || hexDistance(cell.hex, to.hex) < hexDistance(best.hex, to.hex)) best = cell
  }
  return best
}
