import { hexDistance, hexToPoint } from '../core/hex'
import { findPath } from './pathfind'
import { CAPTURE_LAND_RADIUS, CLASH_DISTANCE, MOVE_COST, SOLDIER_STRENGTH, SQUAD_SPEED } from './rules'
import { claimAround, paint } from './territory'
import { canTake } from './towers'
import { ensureCapital, hasForge } from './villages'
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
  const strength = hasForge(world, from) ? SOLDIER_STRENGTH : 1
  const { x, y } = hexToPoint(from.cell.hex, 1)
  const squad: Squad = {
    id: world.nextId++, owner: player, count, strength, path, step: 0, progress: 0,
    home: from, start: null, x, y, prevX: x, prevY: y,
  }
  world.squads.push(squad)
  return squad
}

// A new destination for a squad on the march; it turns around from where it stands right now
export function redirectSquad(world: World, player: PlayerId, squad: Squad, to: Cell): boolean {
  if (squad.owner !== player || !world.squads.includes(squad)) return false
  const from = squadCell(squad)
  // Sent back to the tile it stands on, it just walks to the tile's center
  const path = from === to ? [from, from] : findPath(world.map, from, to)
  if (!path || path.length < 2) return false
  squad.path = path
  squad.step = 0
  squad.progress = 0
  squad.start = { x: squad.x, y: squad.y }
  return true
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
    squad.progress += (SQUAD_SPEED * dt) / MOVE_COST[squad.path[squad.step + 1].terrain]
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
  // A raid ends on open land, and the squad walks back home
  const home = squad.home.owner === squad.owner ? squad.home : nearestVillage(world, cell, squad.owner)
  const path = home && findPath(world.map, cell, home.cell)
  if (!home || !path) {
    removeSquad(world, squad)
    return
  }
  squad.home = home
  squad.path = path
  squad.step = 0
  squad.progress = 0
  squad.start = null
}

function enterVillage(world: World, squad: Squad, village: Village): void {
  if (village.owner === squad.owner) {
    village.population += squad.count
    return
  }
  // Peasants can beat the garrison of a guarded village, but only soldiers can move in
  if (!canTake(world, squad, village.cell)) {
    village.population = Math.max(0, village.population - power(squad))
    return
  }
  village.population -= power(squad)
  if (village.population < 0) {
    const loser = village.owner
    village.owner = squad.owner
    village.population = -village.population / squad.strength // the survivors move in
    village.capturedAt = world.time
    village.capital = false // a captured capital becomes an ordinary village
    claimAround(world.map, village, CAPTURE_LAND_RADIUS, (cell) => canTake(world, squad, cell))
    if (loser !== null) ensureCapital(world, loser, village.cell)
    ensureCapital(world, squad.owner, village.cell)
  }
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
