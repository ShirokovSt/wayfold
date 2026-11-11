import { hexDistance, hexToPoint } from '../core/hex'
import type { GameMap } from './map'
import { findPath } from './pathfind'
import {
  CLASH_DISTANCE,
  FIRST_RAID,
  LAIR_BOUNTY,
  PACK_GROWTH,
  PACK_SPEED,
  RAID_EVERY,
  RAID_SIZE,
  WILD_BITE,
  WILD_BITE_SHARE,
  WILD_RADIUS,
  moveCost,
} from './rules'
import { squadCell } from './squads'
import { paint } from './territory'
import { strengthOf } from './villages'
import type { Cell, Lair, Pack, PlayerId, Squad, Village, World } from './world'

export const BITE_SECONDS = 0.8 // a wolf's leap out to a squad and back

// A den on the cell, with wild land around it
export function makeLair(map: GameMap, cell: Cell, pair: number, size: number): Lair {
  const lair: Lair = { cell, pair, size, pack: size, raidIn: FIRST_RAID, raids: 0 }
  cell.lair = lair
  cell.terrain = 'field' // the den stands in a clearing, so trees do not hide it
  for (const near of map.within(cell, WILD_RADIUS)) near.wild = true
  return lair
}

// Dens grow back and send out raids; wolves bite whoever walks through their land; packs run and fight
export function updateBeasts(world: World, dt: number): void {
  for (const lair of world.lairs) {
    lair.pack = Math.min(lair.size, lair.pack + PACK_GROWTH * dt)
    lair.raidIn -= dt
    if (lair.raidIn <= 0) raid(world, lair)
  }
  biteInWildLand(world, dt)
  movePacks(world, dt)
  fightPacks(world)
}

// A squad that reaches a den fights the whole pack; if it wins, the den is gone and its land is the squad's
export function fightLair(world: World, squad: Squad, lair: Lair): void {
  const attack = squad.count * squad.strength
  if (attack <= lair.pack) {
    lair.pack -= attack
    squad.count = 0
    return
  }
  squad.count = Math.floor((attack - lair.pack) / squad.strength)
  clearLair(world, lair, squad.owner)
}

function clearLair(world: World, lair: Lair, winner: PlayerId): void {
  world.lairs = world.lairs.filter((other) => other !== lair)
  lair.cell.lair = null
  for (const cell of world.map.within(lair.cell, WILD_RADIUS)) {
    cell.wild = world.lairs.some((other) => hexDistance(other.cell.hex, cell.hex) <= WILD_RADIUS)
    if (!cell.wild) paint(cell, winner)
  }
  world.gold[winner] += LAIR_BOUNTY
}

// The pair's dens raid together; wolves go for the nearest village the players hold,
// as an empty neutral village has little to hunt
function raid(world: World, lair: Lair): void {
  lair.raids++
  lair.raidIn = RAID_EVERY[world.map.season] * (0.67 + 0.66 * jitter(lair.pair * 31 + lair.raids))
  const count = Math.min(RAID_SIZE.max, Math.floor(lair.pack / 2))
  if (count < RAID_SIZE.min) return
  const distance = (village: Village) => hexDistance(village.cell.hex, lair.cell.hex)
  const held = world.villages.filter((village) => village.owner !== null).sort((a, b) => distance(a) - distance(b))
  const neutral = world.villages.filter((village) => village.owner === null).sort((a, b) => distance(a) - distance(b))
  for (const village of [...held, ...neutral]) {
    const path = findPath(world.map, lair.cell, village.cell)
    if (!path) continue
    lair.pack -= count
    const { x, y } = hexToPoint(lair.cell.hex, 1)
    world.packs.push({ id: world.nextId++, lair, count, path, step: 0, progress: 0, returning: false, x, y, prevX: x, prevY: y })
    return
  }
}

// Every so often a wolf from the nearest den leaps at each squad in the wild land; it bites when it gets there
function biteInWildLand(world: World, dt: number): void {
  for (const bite of world.bites) {
    bite.age += dt
    if (!bite.hit && bite.age >= BITE_SECONDS / 2) {
      bite.hit = true
      const squad = bite.squad
      if (squad.count > 0) squad.count -= Math.max(1, Math.round(squad.count * WILD_BITE_SHARE))
    }
  }
  world.bites = world.bites.filter((bite) => bite.age < BITE_SECONDS)
  world.squads = world.squads.filter((squad) => squad.count > 0)

  world.biteIn -= dt
  if (world.biteIn > 0) return
  world.biteIn = WILD_BITE
  for (const squad of world.squads) {
    if (!squadCell(squad).wild) continue
    const lair = nearestLair(world, squadCell(squad))
    if (lair) world.bites.push({ from: hexToPoint(lair.cell.hex, 1), squad, age: 0, hit: false })
  }
}

function nearestLair(world: World, cell: Cell): Lair | null {
  let best: Lair | null = null
  for (const lair of world.lairs) {
    if (!best || hexDistance(lair.cell.hex, cell.hex) < hexDistance(best.cell.hex, cell.hex)) best = lair
  }
  return best
}

function movePacks(world: World, dt: number): void {
  for (const pack of [...world.packs]) {
    pack.prevX = pack.x
    pack.prevY = pack.y
    pack.progress += (PACK_SPEED * dt) / moveCost(world.map.season, pack.path[pack.step + 1].terrain)
    if (pack.progress >= 1) {
      pack.step++
      pack.progress -= 1
    }
    if (pack.step === pack.path.length - 1) arrive(world, pack)
    place(pack)
  }
  world.packs = world.packs.filter((pack) => pack.count > 0)
}

// At a village the wolves kill what they can and the survivors head home; at home they rejoin the den
function arrive(world: World, pack: Pack): void {
  const cell = pack.path[pack.path.length - 1]
  if (pack.returning || !cell.village) {
    if (world.lairs.includes(pack.lair)) pack.lair.pack = Math.min(pack.lair.size, pack.lair.pack + pack.count)
    pack.count = 0
    return
  }
  attack(pack, cell.village)
  const home = pack.count > 0 && world.lairs.includes(pack.lair) && findPath(world.map, cell, pack.lair.cell)
  if (!home) {
    pack.count = 0
    return
  }
  pack.path = home
  pack.step = 0
  pack.progress = 0
  pack.returning = true
}

// Wolves cannot take a village, only thin it out
function attack(pack: Pack, village: Village): void {
  const defence = village.population * strengthOf(village)
  village.population = Math.max(0, defence - pack.count) / strengthOf(village)
  pack.count = Math.max(0, pack.count - Math.ceil(defence))
}

// Wolves and squads that meet fight like two squads, whoever owns the squad
function fightPacks(world: World): void {
  for (const pack of world.packs) {
    for (const squad of world.squads) {
      if (pack.count === 0 || squad.count === 0) continue
      if (Math.hypot(pack.x - squad.x, pack.y - squad.y) >= CLASH_DISTANCE) continue
      const losses = Math.min(pack.count, squad.count * squad.strength)
      pack.count -= losses
      squad.count = Math.floor((squad.count * squad.strength - losses) / squad.strength)
    }
  }
  world.packs = world.packs.filter((pack) => pack.count > 0)
  world.squads = world.squads.filter((squad) => squad.count > 0)
}

export function packTarget(pack: Pack): Cell {
  return pack.path[pack.path.length - 1]
}

function place(pack: Pack): void {
  const from = hexToPoint(pack.path[pack.step].hex, 1)
  const next = pack.path[pack.step + 1]
  const to = next ? hexToPoint(next.hex, 1) : from
  pack.x = from.x + (to.x - from.x) * pack.progress
  pack.y = from.y + (to.y - from.y) * pack.progress
}

// A steady "random" number from 0 to 1, the same for both dens of a pair
function jitter(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
