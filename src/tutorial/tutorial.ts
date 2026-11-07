import { addVillage, handmadeWorld } from '../sim/handmade'
import { START_LAND_RADIUS } from '../sim/rules'
import { claimAround } from '../sim/territory'
import { type Cell, HUMAN, RIVAL, type World } from '../sim/world'

// A small island: your capital on the left, two neutral villages, a river with a ford and the rival behind it
const ROWS = [
  'wwwwwwwwwwww',
  'ww..f.wm.ww',
  'w.f....w..ww',
  'w.ff..w...w',
  'w.....fo...w',
  'w..m..w.f.w',
  'w...f..w...w',
  'ww....w..ww',
  'wwwwwwwwwwww',
]

// Village ids in the tutorial world, in the order they are placed
const CAPITAL = 0
const NEAR = 1 // takes one squad from the capital
const FAR = 2 // needs two villages together
const ENEMY = 3
const START_GOLD = 20

export function tutorialWorld(): World {
  const world = handmadeWorld(ROWS)
  const capital = addVillage(world, 2, 4, HUMAN, 12, true)
  addVillage(world, 4, 2, null, 6)
  addVillage(world, 5, 6, null, 20)
  const enemy = addVillage(world, 9, 4, RIVAL, 14, true)
  claimAround(world.map, capital, START_LAND_RADIUS)
  claimAround(world.map, enemy, START_LAND_RADIUS)
  world.gold[HUMAN] = START_GOLD
  return world
}

export type StepId = 'intro' | 'capture' | 'land' | 'pause' | 'group' | 'farm' | 'buildings' | 'redirect' | 'win'

// A step is done when the player does what it asks; steps without `done` wait for the Next button
export interface Step {
  id: StepId
  marked: number[] // villages ringed on the board
  done?: (world: World, paused: boolean) => boolean
}

export const STEPS: Step[] = [
  { id: 'intro', marked: [CAPITAL, ENEMY] },
  { id: 'capture', marked: [CAPITAL, NEAR], done: (world) => world.villages[NEAR].owner === HUMAN },
  { id: 'land', marked: [] },
  { id: 'pause', marked: [], done: (_, paused) => paused },
  { id: 'group', marked: [CAPITAL, NEAR, FAR], done: (world) => world.villages[FAR].owner === HUMAN },
  { id: 'farm', marked: [], done: (world) => world.map.cells.some((cell) => isOwnFarm(cell)) },
  { id: 'buildings', marked: [] },
  { id: 'redirect', marked: [], done: (world) => world.squads.some((s) => s.owner === HUMAN && s.start !== null) },
  { id: 'win', marked: [ENEMY], done: (world) => world.winner === HUMAN },
]

function isOwnFarm(cell: Cell): boolean {
  return cell.owner === HUMAN && cell.building?.kind === 'farm'
}
