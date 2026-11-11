import { describe, expect, it } from 'vitest'
import { Rival } from '../ai/rival'
import { createRandom } from '../core/rng'
import { upgradeToTown } from '../sim/economy'
import { findPath } from '../sim/pathfind'
import { TICK_SECONDS } from '../sim/rules'
import { sendSquad, squadSize } from '../sim/squads'
import { tick } from '../sim/tick'
import { isGuarded } from '../sim/towers'
import { HUMAN, type World } from '../sim/world'
import { STEPS, tutorialWorld } from './tutorial'

function play(world: World, seconds: number, rival?: Rival): void {
  for (let t = 0; t < seconds && world.winner === null; t += TICK_SECONDS) {
    rival?.update(world, TICK_SECONDS)
    tick(world, TICK_SECONDS)
  }
}

const step = (id: string) => STEPS.find((s) => s.id === id)!

describe('tutorial', () => {
  it('every village can be reached from the capital', () => {
    const world = tutorialWorld()
    for (const village of world.villages) expect(findPath(world.map, world.villages[0].cell, village.cell)).not.toBeNull()
  })

  it('the near village needs all of the capital, not half', () => {
    const world = tutorialWorld()
    const [capital, near] = world.villages
    expect(squadSize(capital.population, 'half')).toBeLessThan(near.population)
    expect(squadSize(capital.population, 'all')).toBeGreaterThan(near.population)
  })

  it('the capital takes the near village with one squad', () => {
    const world = tutorialWorld()
    expect(step('capture').done!(world, false)).toBe(false)
    sendSquad(world, HUMAN, world.villages[0], world.villages[1].cell)
    play(world, 20)
    expect(step('capture').done!(world, false)).toBe(true)
  })

  it('the far village is too big for the capital alone at the start', () => {
    const world = tutorialWorld()
    expect(world.villages[2].population).toBeGreaterThan(world.villages[0].population)
  })

  it('the town step is done once a village of yours is a town', () => {
    const world = tutorialWorld()
    expect(step('town').done!(world, false)).toBe(false)
    world.gold[HUMAN] = 100
    upgradeToTown(world, HUMAN, world.villages[0])
    expect(step('town').done!(world, false)).toBe(true)
  })

  it('the rival village by the river is open, its capital only soldiers can take', () => {
    const world = tutorialWorld()
    const [, , , village, capital] = world.villages
    expect(isGuarded(world, village.cell, HUMAN)).toBe(false)
    expect(isGuarded(world, capital.cell, HUMAN)).toBe(true)
    // The way from your capital to the open village stays out of the tower's reach
    const path = findPath(world.map, world.villages[0].cell, village.cell)!
    expect(path.some((cell) => isGuarded(world, cell, HUMAN))).toBe(false)
  })

  it('has a den off the ways to the neutral villages, cleared by a big enough squad', () => {
    const world = tutorialWorld()
    const [capital, near, far] = world.villages
    expect(world.map.cells.filter((cell) => cell.wild && cell.owner !== null)).toHaveLength(0)
    for (const village of [near, far]) {
      expect(findPath(world.map, capital.cell, village.cell)!.some((cell) => cell.wild)).toBe(false)
    }
    expect(step('wolves').done!(world, false)).toBe(false)
    capital.population = 30
    sendSquad(world, HUMAN, capital, world.lairs[0].cell)
    play(world, 20)
    expect(step('wolves').done!(world, false)).toBe(true)
    expect(world.packs).toHaveLength(0) // the tutorial's wolves never raid
  })

  it('can be played to the end against the waiting rival', () => {
    const world = tutorialWorld()
    play(world, 10 * 60, new Rival(HUMAN, createRandom(3)))
    expect(step('group').done!(world, false)).toBe(true)
    expect(step('enemy').done!(world, false)).toBe(true)
    expect(step('tower').done!(world, false)).toBe(true)
  })
})
