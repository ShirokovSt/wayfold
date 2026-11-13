import { SQRT3, hexDistance, hexToPoint } from '../core/hex'
import { fightLair } from './beasts'
import { findPath } from './pathfind'
import { CAPTURE_LAND_RADIUS, CLASH_DISTANCE, SQUAD_SPEED, moveCost } from './rules'
import { claimAround, paint } from './territory'
import { canTake } from './towers'
import { ensureCapital, strengthOf } from './villages'
import type { Cell, PlayerId, Squad, Village, World } from './world'

// How many of the village's people set off: all of them, or half so the village is not left empty
export type Share = 'half' | 'all'

export function squadSize(population: number, share: Share): number {
  const people = Math.floor(population)
  return share === 'all' || people <= 1 ? people : Math.floor(people / 2)
}

// The one way to give orders, for the player and the AI alike
export function sendSquad(world: World, player: PlayerId, from: Village, to: Cell, share: Share = 'all'): Squad | null {
  if (from.owner !== player) return null
  const count = squadSize(from.population, share)
  const path = findPath(world.map, from.cell, to)
  if (count < 1 || !path || path.length < 2) return null

  from.population -= count
  const strength = strengthOf(from)
  const { x, y } = hexToPoint(from.cell.hex, 1)
  const squad: Squad = {
    id: world.nextId++, owner: player, count, strength, path, step: 0, progress: 0,
    home: from, returning: false, start: null, x, y, prevX: x, prevY: y,
  }
  world.squads.push(squad)
  world.orders.push({ at: world.ticks, player, kind: 'send', from: from.cell.index, to: to.index, share })
  return squad
}

// A new destination for a squad on the march; it turns around from where it stands right now
export function redirectSquad(world: World, player: PlayerId, squad: Squad, to: Cell): boolean {
  if (squad.owner !== player || !world.squads.includes(squad)) return false
  const from = squadCell(squad)
  // Sent back to the tile it stands on, it just walks to the tile's center
  const path = from === to ? [from, from] : findPath(world.map, from, to)
  if (!path || path.length < 2) return false
  turn(squad, path)
  world.orders.push({ at: world.ticks, player, kind: 'redirect', squad: squad.id, to: to.index })
  return true
}

// Sets off on a new path from where the squad is right now. The way to the next tile center is mostly
// shorter than a whole step, so the step starts partly done, as if from a tile back on the same line:
// the squad keeps its pace however often it turns
function turn(squad: Squad, path: Cell[], returning = false): void {
  const to = hexToPoint((path[1] ?? path[0]).hex, 1)
  const left = Math.min(1, Math.hypot(to.x - squad.x, to.y - squad.y) / SQRT3) // of a step
  const back = left > 0 ? 1 / left : 0
  squad.path = path
  squad.step = 0
  squad.progress = 1 - left
  squad.start = { x: to.x + (squad.x - to.x) * back, y: to.y + (squad.y - to.y) * back }
  squad.returning = returning
}

// Has no village to walk to and waits on its tile for orders
export function isStanding(squad: Squad): boolean {
  return squad.path.length === 1
}

// The tile the squad is standing on: it steps onto the next one halfway there
export function squadCell(squad: Squad): Cell {
  const next = squad.path[squad.step + 1]
  return next && squad.progress >= 0.5 ? next : squad.path[squad.step]
}

export function squadTarget(squad: Squad): Cell {
  return squad.path[squad.path.length - 1]
}

export function moveSquads(world: World, dt: number): void {
  for (const squad of [...world.squads]) {
    squad.prevX = squad.x
    squad.prevY = squad.y
    if (isStanding(squad)) continue
    // Its home fell while it was walking back: it stops at the nearest tile and looks for another one
    if (squad.returning && squad.home.owner !== squad.owner) turn(squad, [squadCell(squad), squadCell(squad)])
    squad.progress += (SQUAD_SPEED * dt) / moveCost(world.map.season, squad.path[squad.step + 1].terrain)
    if (squad.progress >= 1) {
      squad.step++
      squad.progress -= 1
    }
    const cell = squadCell(squad)
    if (canTake(world, squad, cell)) paint(cell, squad.owner)
    if (squad.step === squad.path.length - 1) arrive(world, squad)
    placeSquad(squad)
  }
}

// Enemy squads that meet lose the same strength: the weaker one is wiped out
export function resolveClashes(world: World): void {
  const squads = world.squads
  for (let i = 0; i < squads.length; i++) {
    for (let j = i + 1; j < squads.length; j++) {
      const a = squads[i]
      const b = squads[j]
      if (a.owner === b.owner || a.count === 0 || b.count === 0) continue
      if (Math.hypot(a.x - b.x, a.y - b.y) < CLASH_DISTANCE) {
        const losses = Math.min(power(a), power(b))
        a.count = Math.floor((power(a) - losses) / a.strength)
        b.count = Math.floor((power(b) - losses) / b.strength)
      }
    }
  }
  world.squads = squads.filter((squad) => squad.count > 0)
}

function power(squad: Squad): number {
  return squad.count * squad.strength
}

function arrive(world: World, squad: Squad): void {
  const cell = squadTarget(squad)
  if (cell.village) {
    enterVillage(world, squad, cell.village)
    removeSquad(world, squad)
    return
  }
  if (cell.lair) fightLair(world, squad, cell.lair)
  if (squad.count === 0) {
    removeSquad(world, squad)
    return
  }
  // A raid ends on open land, or at a cleared den, and the squad walks back home;
  // with no village of its own left to reach it stays there, still yours to lead
  const home = squad.home.owner === squad.owner ? squad.home : nearestVillage(world, cell, squad.owner)
  const path = home && findPath(world.map, cell, home.cell)
  if (home) squad.home = home
  turn(squad, path ?? [cell], path !== null)
  squad.start = null
}

function enterVillage(world: World, squad: Squad, village: Village): void {
  if (village.owner === squad.owner) {
    village.population += squad.count
    return
  }
  // A town's people defend as soldiers too
  const defence = village.population * strengthOf(village)
  const attack = power(squad)
  // Peasants can beat the garrison of a guarded village, but only soldiers can move in
  if (attack <= defence || !canTake(world, squad, village.cell)) {
    village.population = Math.max(0, defence - attack) / strengthOf(village)
    return
  }
  const loser = village.owner
  village.owner = squad.owner
  village.population = (attack - defence) / squad.strength // the survivors move in
  village.capturedAt = world.time
  village.capital = false // a captured capital becomes an ordinary village
  claimAround(world.map, village, CAPTURE_LAND_RADIUS, (cell) => canTake(world, squad, cell))
  if (loser !== null) ensureCapital(world, loser, village.cell)
  ensureCapital(world, squad.owner, village.cell)
}

function nearestVillage(world: World, cell: Cell, owner: PlayerId): Village | null {
  const own = world.villages.filter((village) => village.owner === owner)
  own.sort((a, b) => hexDistance(cell.hex, a.cell.hex) - hexDistance(cell.hex, b.cell.hex))
  return own[0] ?? null
}

function removeSquad(world: World, squad: Squad): void {
  squad.count = 0
  world.squads = world.squads.filter((other) => other !== squad)
}

function placeSquad(squad: Squad): void {
  const from = squad.step === 0 && squad.start ? squad.start : hexToPoint(squad.path[squad.step].hex, 1)
  const next = squad.path[squad.step + 1]
  const to = next ? hexToPoint(next.hex, 1) : from
  squad.x = from.x + (to.x - from.x) * squad.progress
  squad.y = from.y + (to.y - from.y) * squad.progress
}
