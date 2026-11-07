import { describe, expect, it } from 'vitest'
import { Rival } from '../ai/rival'
import { createRandom } from '../core/rng'
import { findPath } from '../sim/pathfind'
import { TICK_SECONDS } from '../sim/rules'
import { sendSquad } from '../sim/squads'
import { tick } from '../sim/tick'
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

  it('can be played to the end against the waiting rival', () => {
    const world = tutorialWorld()
    play(world, 10 * 60, new Rival(HUMAN, createRandom(3)))
    expect(step('group').done!(world, false)).toBe(true)
    expect(step('win').done!(world, false)).toBe(true)
  })
})
