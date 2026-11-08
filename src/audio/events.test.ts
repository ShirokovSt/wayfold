import { describe, expect, it } from 'vitest'
import { build, upgradeToTown } from '../sim/economy'
import { addVillage, handmadeWorld } from '../sim/handmade'
import { TICK_SECONDS } from '../sim/rules'
import { sendSquad } from '../sim/squads'
import { tick } from '../sim/tick'
import { HUMAN, RIVAL, type World } from '../sim/world'
import { EventWatcher } from './events'

const FIELD = ['........', '.......', '........', '.......']

// Runs the match until every squad has arrived, then asks what was heard
function heardAfterMarch(watcher: EventWatcher, world: World) {
  for (let i = 0; i < 5000 && world.squads.length > 0; i++) tick(world, TICK_SECONDS)
  return watcher.watch(world)
}

function setUp() {
  const world = handmadeWorld(FIELD)
  const home = addVillage(world, 0, 0, HUMAN, 20, true)
  const near = addVillage(world, 3, 0, RIVAL, 5)
  const far = addVillage(world, 6, 3, RIVAL, 10, true)
  const watcher = new EventWatcher()
  watcher.watch(world)
  return { world, home, near, far, watcher }
}

describe('sound events', () => {
  it('starts a new match quietly', () => {
    const { world, home, near } = setUp()
    sendSquad(world, HUMAN, home, near.cell)
    expect(new EventWatcher().watch(world)).toEqual([])
  })

  it('hears the player send a squad and take a village', () => {
    const { world, home, near, watcher } = setUp()
    sendSquad(world, HUMAN, home, near.cell)
    expect(watcher.watch(world)).toEqual(['send'])
    expect(heardAfterMarch(watcher, world)).toEqual(['capture'])
  })

  it('hears an attack break against a village', () => {
    const { world, home, far, watcher } = setUp()
    home.population = 4
    sendSquad(world, HUMAN, home, far.cell)
    watcher.watch(world)
    expect(heardAfterMarch(watcher, world)).toEqual(['repelled'])
    expect(far.owner).toBe(RIVAL)
  })

  it('hears the loss of a village, but not the rival setting off', () => {
    const { world, near, watcher } = setUp()
    const outpost = addVillage(world, 5, 1, HUMAN, 1)
    watcher.watch(world)
    sendSquad(world, RIVAL, near, outpost.cell)
    expect(watcher.watch(world)).toEqual([])
    expect(heardAfterMarch(watcher, world)).toEqual(['loss'])
  })

  it('hears building and the town upgrade', () => {
    const { world, home, watcher } = setUp()
    world.gold[HUMAN] = 500
    const field = world.map.cellAtOffset(1, 1)!
    field.owner = HUMAN
    expect(build(world, HUMAN, field, 'farm')).toBe(true)
    expect(watcher.watch(world)).toEqual(['build'])
    expect(upgradeToTown(world, HUMAN, home)).toBe(true)
    expect(watcher.watch(world)).toEqual(['town'])
  })

  it('plays only the victory when the last village falls', () => {
    const { world, home, near, far, watcher } = setUp()
    near.owner = HUMAN
    far.population = 1
    home.population = 30
    watcher.watch(world)
    sendSquad(world, HUMAN, home, far.cell)
    watcher.watch(world)
    expect(heardAfterMarch(watcher, world)).toEqual(['victory'])
  })
})
