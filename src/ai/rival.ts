import { hexDistance } from '../core/hex'
import type { Random } from '../core/rng'
import { findPath, pathDuration } from '../sim/pathfind'
import { POPULATION_CAP } from '../sim/rules'
import { sendSquad, squadTarget } from '../sim/squads'
import { growthRate } from '../sim/villages'
import type { Cell, PlayerId, Village, World } from '../sim/world'

// How the rival plays: how soon and how often it moves, and how cautiously
const FIRST_MOVE_SECONDS = 10
const THINK_SECONDS = 3.5
const SAFETY_MARGIN = 4 // extra people sent on top of what the target should have on arrival

// A simple opponent: every few seconds it makes one move — defend, capture or raid
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

  // Picks the cheapest and closest village it can surely take
  private capture(world: World): boolean {
    let best: { from: Village; to: Village; score: number } | null = null
    for (const from of this.villages(world)) {
      for (const to of world.villages) {
        if (to.owner === this.player) continue
        const path = findPath(world.map, from.cell, to.cell)
        if (!path) continue
        const time = pathDuration(path)
        const needed = to.population + growthRate(world, to) * time + SAFETY_MARGIN -
          incoming(world, to, (owner) => owner === this.player)
        const score = time + needed * 0.3
        if (from.population >= needed && (!best || score < best.score)) best = { from, to, score }
      }
    }
    return best !== null && sendSquad(world, this.player, best.from, best.to.cell) !== null
  }

  // A full village with nothing to take marches over the nearest enemy land and back
  private raid(world: World): boolean {
    const full = this.villages(world).find((village) => village.population >= POPULATION_CAP * 0.8)
    if (!full) return false
    const target = nearest(
      world.map.cells.filter((cell) => cell.owner !== null && cell.owner !== this.player && !cell.village),
      full.cell,
    )
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
