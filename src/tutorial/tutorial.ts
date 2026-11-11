import { addLair, addVillage, handmadeWorld } from '../sim/handmade'
import { CAPTURE_LAND_RADIUS, START_LAND_RADIUS } from '../sim/rules'
import { claimAround } from '../sim/territory'
import { type Cell, HUMAN, RIVAL, type World } from '../sim/world'

// A small island: your capital on the left, two neutral villages, a river with a ford,
// and behind it the rival: an open village by the ford and its capital guarded by a tower
const ROWS = [
  'wwwwwwwwwwwwww',
  'ww..f.wm...ww',
  'w.f....w....ww',
  'w.ff..w....fw',
  'w.....fo.....w',
  'w..m..w.f...w',
  'w...f..w.....w',
  'ww....w...mww',
  'wwwwwwwwwwwwww',
]

// Village ids in the tutorial world, in the order they are placed
const CAPITAL = 0
const NEAR = 1 // takes all the capital's people, but not half of them
const FAR = 2 // needs two villages together
const ENEMY_VILLAGE = 3 // peasants can take it
const ENEMY_CAPITAL = 4 // guarded by a tower: only soldiers can take it
const START_GOLD = 20
const DEN_PACK = 10 // a small pack: one village with help can beat it

export function tutorialWorld(): World {
  const world = handmadeWorld(ROWS)
  const capital = addVillage(world, 2, 4, HUMAN, 12, true)
  addVillage(world, 4, 2, null, 8)
  addVillage(world, 5, 6, null, 20)
  const enemyVillage = addVillage(world, 9, 3, RIVAL, 10)
  const enemyCapital = addVillage(world, 11, 5, RIVAL, 14, true)
  claimAround(world.map, capital, START_LAND_RADIUS)
  claimAround(world.map, enemyVillage, CAPTURE_LAND_RADIUS)
  claimAround(world.map, enemyCapital, START_LAND_RADIUS)
  world.map.cellAtOffset(12, 6)!.building = { kind: 'tower', reload: 0 } // behind the capital, off the way to the village
  // A small den up north, off the ways to the neutral villages; its wolves stay home in the tutorial
  addLair(world, 5, 1, DEN_PACK).raidIn = Infinity
  world.gold[HUMAN] = START_GOLD
  return world
}

export type StepId =
  | 'intro' | 'capture' | 'land' | 'pause' | 'group' | 'farm' | 'redirect' | 'wolves' | 'enemy' | 'town' | 'tower'

// A step is done when the player does what it asks; steps without `done` wait for the Next button
export interface Step {
  id: StepId
  marked: number[] // villages ringed on the board
  den?: boolean // the wolves' den is ringed too
  done?: (world: World, paused: boolean) => boolean
}

export const STEPS: Step[] = [
  { id: 'intro', marked: [CAPITAL, ENEMY_CAPITAL] },
  { id: 'capture', marked: [CAPITAL, NEAR], done: (world) => world.villages[NEAR].owner === HUMAN },
  { id: 'land', marked: [] },
  { id: 'pause', marked: [], done: (_, paused) => paused },
  { id: 'group', marked: [CAPITAL, NEAR, FAR], done: (world) => world.villages[FAR].owner === HUMAN },
  { id: 'farm', marked: [], done: (world) => world.map.cells.some((cell) => isOwnFarm(cell)) },
  { id: 'redirect', marked: [], done: (world) => world.squads.some((s) => s.owner === HUMAN && s.start !== null) },
  { id: 'wolves', marked: [], den: true, done: (world) => world.lairs.length === 0 },
  { id: 'enemy', marked: [ENEMY_VILLAGE], done: (world) => world.villages[ENEMY_VILLAGE].owner === HUMAN },
  { id: 'town', marked: [CAPITAL], done: (world) => world.villages.some((v) => v.owner === HUMAN && v.town) },
  { id: 'tower', marked: [ENEMY_CAPITAL], done: (world) => world.winner === HUMAN },
]

function isOwnFarm(cell: Cell): boolean {
  return cell.owner === HUMAN && cell.building?.kind === 'farm'
}
