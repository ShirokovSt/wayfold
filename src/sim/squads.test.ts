import { describe, expect, it } from 'vitest'
import { SQUAD_SPEED, TICK_SECONDS } from './rules'
import { redirectSquad, sendSquad } from './squads'
import { addVillage, handmadeWorld } from './handmade'
import { tick } from './tick'
import { growthRate } from './villages'
import { HUMAN, RIVAL, type World } from './world'

const FIELD = ['.......', '......', '.......']

function run(world: World, seconds: number): void {
  for (let t = 0; t < seconds; t += TICK_SECONDS) tick(world, TICK_SECONDS)
}

describe('squads', () => {
  it('take all the people of the village and repaint the tiles they cross', () => {
    const world = handmadeWorld(FIELD)
    const home = addVillage(world, 0, 0, HUMAN, 7.6)
    addVillage(world, 6, 2, RIVAL, 1)
    const target = world.map.cellAtOffset(6, 0)!

    const squad = sendSquad(world, HUMAN, home, target)!
    expect(squad.count).toBe(7)
    expect(home.population).toBeCloseTo(0.6)

    run(world, 3)
    for (let col = 1; col <= 3; col++) expect(world.map.cellAtOffset(col, 0)!.owner).toBe(HUMAN)
  })

  it('can take half of the people, leaving the rest at home', () => {
    const world = handmadeWorld(FIELD)
    const home = addVillage(world, 0, 0, HUMAN, 7.6)
    expect(sendSquad(world, HUMAN, home, world.map.cellAtOffset(6, 0)!, 'half')!.count).toBe(3)
    expect(home.population).toBeCloseTo(4.6)
    const lone = addVillage(world, 0, 2, HUMAN, 1)
    expect(sendSquad(world, HUMAN, lone, world.map.cellAtOffset(6, 0)!, 'half')!.count).toBe(1)
  })

  it('return home after a raid on open land', () => {
    const world = handmadeWorld(FIELD)
    const home = addVillage(world, 0, 0, HUMAN, 5)
    addVillage(world, 6, 2, RIVAL, 1)
    sendSquad(world, HUMAN, home, world.map.cellAtOffset(3, 0)!)
    run(world, 10)
    expect(world.squads).toHaveLength(0)
    expect(home.population).toBeGreaterThanOrEqual(5)
  })

  it('capture a village when they outnumber it, and claim the land around', () => {
    const world = handmadeWorld(FIELD)
    const home = addVillage(world, 0, 0, HUMAN, 10)
    const neutral = addVillage(world, 3, 0, null, 6)
    addVillage(world, 6, 2, RIVAL, 1)
    sendSquad(world, HUMAN, home, neutral.cell)
    run(world, 3 / SQUAD_SPEED + 0.1) // three tiles, just after the arrival
    expect(neutral.owner).toBe(HUMAN)
    expect(neutral.population).toBeCloseTo(4, 0)
    expect(world.map.cellAtOffset(4, 0)!.owner).toBe(HUMAN)
  })

  it('cannot be sent from someone else’s village', () => {
    const world = handmadeWorld(FIELD)
    const enemy = addVillage(world, 0, 0, RIVAL, 10)
    expect(sendSquad(world, HUMAN, enemy, world.map.cellAtOffset(3, 0)!)).toBeNull()
  })

  it('cancel each other out when enemies meet', () => {
    const world = handmadeWorld(FIELD)
    const left = addVillage(world, 0, 0, HUMAN, 9)
    const right = addVillage(world, 6, 0, RIVAL, 4)
    sendSquad(world, HUMAN, left, right.cell)
    sendSquad(world, RIVAL, right, left.cell)
    run(world, 3.5 / SQUAD_SPEED) // they meet halfway, after three tiles each
    expect(world.squads).toHaveLength(1)
    expect(world.squads[0].owner).toBe(HUMAN)
    expect(world.squads[0].count).toBe(5)
  })
})

describe('villages', () => {
  it('grow faster with more own land around', () => {
    const world = handmadeWorld(FIELD)
    const village = addVillage(world, 3, 1, HUMAN, 0)
    addVillage(world, 0, 0, RIVAL, 1)
    const bare = growthRate(world, village)
    world.map.cellAtOffset(2, 1)!.owner = HUMAN
    world.map.cellAtOffset(4, 1)!.owner = HUMAN
    expect(growthRate(world, village)).toBeGreaterThan(bare)
  })

  it('neutral ones keep their garrison', () => {
    const world = handmadeWorld(FIELD)
    const neutral = addVillage(world, 3, 1, null, 6)
    addVillage(world, 0, 0, HUMAN, 1)
    addVillage(world, 6, 2, RIVAL, 1)
    run(world, 5)
    expect(neutral.population).toBe(6)
  })
})

describe('redirected squads', () => {
  it('turn around on the way and head for the new target', () => {
    const world = handmadeWorld(FIELD)
    const home = addVillage(world, 0, 0, HUMAN, 5)
    addVillage(world, 6, 2, RIVAL, 1)
    const squad = sendSquad(world, HUMAN, home, world.map.cellAtOffset(6, 0)!)!
    run(world, 1.7 / SQUAD_SPEED)
    const before = { x: squad.x, y: squad.y }

    const newTarget = world.map.cellAtOffset(2, 2)!
    expect(redirectSquad(world, HUMAN, squad, newTarget)).toBe(true)
    run(world, TICK_SECONDS)
    expect(Math.hypot(squad.x - before.x, squad.y - before.y)).toBeLessThan(0.2) // one tick of walking, no jump back to a tile center
    run(world, 3 / SQUAD_SPEED)
    expect(newTarget.owner).toBe(HUMAN)
  })

  it('can be called back home', () => {
    const world = handmadeWorld(FIELD)
    const home = addVillage(world, 0, 0, HUMAN, 5)
    addVillage(world, 6, 2, RIVAL, 1)
    const squad = sendSquad(world, HUMAN, home, world.map.cellAtOffset(6, 0)!)!
    run(world, 0.3)
    expect(redirectSquad(world, HUMAN, squad, home.cell)).toBe(true)
    run(world, 1)
    expect(world.squads).toHaveLength(0)
    expect(home.population).toBeGreaterThanOrEqual(5)
  })

  it('only obey their owner', () => {
    const world = handmadeWorld(FIELD)
    const enemy = addVillage(world, 6, 0, RIVAL, 5)
    addVillage(world, 0, 0, HUMAN, 1)
    const squad = sendSquad(world, RIVAL, enemy, world.map.cellAtOffset(2, 0)!)!
    expect(redirectSquad(world, HUMAN, squad, world.map.cellAtOffset(6, 2)!)).toBe(false)
  })
})

describe('capitals', () => {
  it('move to the most populous village when the capital falls', () => {
    const world = handmadeWorld(FIELD)
    const capital = addVillage(world, 3, 0, RIVAL, 2, true)
    const small = addVillage(world, 6, 2, RIVAL, 3)
    const big = addVillage(world, 0, 2, RIVAL, 9)
    const attacker = addVillage(world, 0, 0, HUMAN, 10, true)
    sendSquad(world, HUMAN, attacker, capital.cell)
    run(world, 3 / SQUAD_SPEED + 0.1)

    expect(capital.owner).toBe(HUMAN)
    expect(capital.capital).toBe(false) // the human already has a capital
    expect(attacker.capital).toBe(true)
    expect(big.capital).toBe(true)
    expect(small.capital).toBe(false)
  })
})
