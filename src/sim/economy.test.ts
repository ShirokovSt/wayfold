import { describe, expect, it } from 'vitest'
import { build, canBuildOn } from './economy'
import { estateVillage } from './estates'
import { fireTowers } from './towers'
import { BUILDING_COST, GOLD_PER_TILE, SQUAD_SPEED, TICK_SECONDS } from './rules'
import { sendSquad } from './squads'
import { addVillage, handmadeWorld } from './handmade'
import { tick } from './tick'
import { growthRate } from './villages'
import { HUMAN, RIVAL, type World } from './world'

const FIELD = ['.......', '......', '.......']

function run(world: World, seconds: number): void {
  for (let t = 0; t < seconds; t += TICK_SECONDS) tick(world, TICK_SECONDS)
}

function own(world: World, owner: typeof HUMAN | typeof RIVAL, ...cells: [number, number][]): void {
  for (const [col, row] of cells) world.map.cellAtOffset(col, row)!.owner = owner
}

describe('estates', () => {
  it('give each tile to the nearest own village, the longer-held one on a tie', () => {
    const world = handmadeWorld(FIELD)
    const left = addVillage(world, 0, 0, HUMAN, 1)
    const right = addVillage(world, 4, 0, HUMAN, 1)
    right.capturedAt = 30
    addVillage(world, 6, 2, RIVAL, 1)
    own(world, HUMAN, [1, 0], [2, 0], [3, 0])
    const at = (col: number) => estateVillage(world, world.map.cellAtOffset(col, 0)!)
    expect(at(1)).toBe(left)
    expect(at(3)).toBe(right)
    expect(at(2)).toBe(left) // two steps from both
  })
})

describe('gold', () => {
  it('comes from every own tile', () => {
    const world = handmadeWorld(FIELD)
    addVillage(world, 0, 0, HUMAN, 1)
    addVillage(world, 6, 2, RIVAL, 1)
    own(world, HUMAN, [1, 0], [2, 0], [3, 0])
    run(world, 10)
    expect(world.gold[HUMAN]).toBeCloseTo(4 * GOLD_PER_TILE * 10, 0) // three tiles and the village
  })
})

describe('buildings', () => {
  function startingWorld(): World {
    const world = handmadeWorld(['..f....', '......', '.......'])
    addVillage(world, 0, 0, HUMAN, 10)
    addVillage(world, 6, 2, RIVAL, 10)
    own(world, HUMAN, [1, 0], [2, 0], [1, 1])
    world.gold[HUMAN] = 100
    return world
  }

  it('cost gold and go only on own empty fields', () => {
    const world = startingWorld()
    const field = world.map.cellAtOffset(1, 0)!
    expect(canBuildOn(world, HUMAN, world.map.cellAtOffset(2, 0)!)).toBe(false) // forest
    expect(canBuildOn(world, HUMAN, world.map.cellAtOffset(0, 0)!)).toBe(false) // the village
    expect(canBuildOn(world, HUMAN, world.map.cellAtOffset(5, 0)!)).toBe(false) // nobody's land
    expect(build(world, HUMAN, field, 'farm')).toBe(true)
    expect(world.gold[HUMAN]).toBe(100 - BUILDING_COST.farm)
    expect(build(world, HUMAN, field, 'tower')).toBe(false) // taken
  })

  it('cannot be bought without enough gold', () => {
    const world = startingWorld()
    world.gold[HUMAN] = BUILDING_COST.forge - 1
    expect(build(world, HUMAN, world.map.cellAtOffset(1, 0)!, 'forge')).toBe(false)
  })

  it('farm makes its village grow faster', () => {
    const world = startingWorld()
    const village = world.villages[0]
    const before = growthRate(world, village)
    build(world, HUMAN, world.map.cellAtOffset(1, 0)!, 'farm')
    expect(growthRate(world, village)).toBeGreaterThan(before)
  })

  it('forge sends soldiers worth two each', () => {
    const world = startingWorld()
    const village = world.villages[0]
    build(world, HUMAN, world.map.cellAtOffset(1, 1)!, 'forge')
    const target = world.villages[1]
    target.population = 15
    const squad = sendSquad(world, HUMAN, village, target.cell)!
    expect(squad.strength).toBe(2)
    run(world, 9 / SQUAD_SPEED)
    expect(target.owner).toBe(HUMAN) // 10 soldiers (strength 20) beat the 15+ people grown meanwhile
  })

  it('tower shoots passing enemies', () => {
    const world = startingWorld()
    build(world, HUMAN, world.map.cellAtOffset(1, 1)!, 'tower')
    const enemy = world.villages[1]
    const squad = sendSquad(world, RIVAL, enemy, world.map.cellAtOffset(1, 2)!)!
    const sent = squad.count
    run(world, 6 / SQUAD_SPEED)
    expect(squad.count).toBeLessThan(sent)
  })

  it('change hands when a raid repaints their tile', () => {
    const world = startingWorld()
    const field = world.map.cellAtOffset(1, 0)!
    build(world, HUMAN, field, 'farm')
    world.villages[1].population = 20
    sendSquad(world, RIVAL, world.villages[1], field)
    run(world, 8 / SQUAD_SPEED)
    expect(field.owner).toBe(RIVAL)
    expect(field.building?.kind).toBe('farm')
  })
})

describe('tower volleys', () => {
  it('take a tenth of a big squad, at least one person', () => {
    const world = handmadeWorld(FIELD)
    addVillage(world, 0, 0, HUMAN, 1)
    const enemy = addVillage(world, 6, 2, RIVAL, 40)
    own(world, HUMAN, [1, 1])
    world.map.cellAtOffset(1, 1)!.building = { kind: 'tower', reload: 0 }
    const squad = sendSquad(world, RIVAL, enemy, world.map.cellAtOffset(2, 1)!)!
    squad.x = squad.prevX = 3 // put it right next to the tower
    squad.y = squad.prevY = 1.5
    fireTowers(world, TICK_SECONDS)
    expect(squad.count).toBe(36)
  })
})

describe('tower zones', () => {
  // Your village with a tower next to it; the rival marches 30 people from the far corner
  function guardedWorld(soldiers: boolean) {
    const world = handmadeWorld(FIELD)
    const village = addVillage(world, 0, 0, HUMAN, 3)
    const enemy = addVillage(world, 6, 2, RIVAL, 30)
    const tower = world.map.cellAtOffset(1, 1)!
    own(world, HUMAN, [1, 1])
    tower.building = { kind: 'tower', reload: 0 }
    const march = (target: [number, number]) => {
      const squad = sendSquad(world, RIVAL, enemy, world.map.cellAtOffset(...target)!)!
      if (soldiers) squad.strength = 2
      run(world, 9 / SQUAD_SPEED)
    }
    return { world, village, tower, march }
  }

  it('peasants cannot repaint guarded land, soldiers can', () => {
    const peasants = guardedWorld(false)
    peasants.march([2, 0])
    expect(peasants.world.map.cellAtOffset(2, 0)!.owner).toBe(null)

    const soldiers = guardedWorld(true)
    soldiers.march([2, 0])
    expect(soldiers.world.map.cellAtOffset(2, 0)!.owner).toBe(RIVAL)
  })

  it('peasants only beat the garrison of a guarded village, soldiers take it', () => {
    const peasants = guardedWorld(false)
    peasants.march([0, 0])
    expect(peasants.village.owner).toBe(HUMAN)
    expect(peasants.village.population).toBeLessThan(1)

    const soldiers = guardedWorld(true)
    soldiers.march([0, 0])
    expect(soldiers.village.owner).toBe(RIVAL)
  })

  it('only soldiers take the tower itself', () => {
    const peasants = guardedWorld(false)
    peasants.march([1, 1])
    expect(peasants.tower.owner).toBe(HUMAN)

    const soldiers = guardedWorld(true)
    soldiers.march([1, 1])
    expect(soldiers.tower.owner).toBe(RIVAL)
    expect(soldiers.tower.building?.kind).toBe('tower')
  })
})

describe('tower placement', () => {
  it('is not allowed within two tiles of an enemy village', () => {
    const world = handmadeWorld(FIELD)
    addVillage(world, 0, 1, HUMAN, 10)
    addVillage(world, 4, 1, RIVAL, 10)
    own(world, HUMAN, [1, 1], [2, 1])
    world.gold[HUMAN] = 100
    const doorstep = world.map.cellAtOffset(2, 1)! // two steps from the rival
    expect(build(world, HUMAN, doorstep, 'tower')).toBe(false)
    expect(build(world, HUMAN, doorstep, 'farm')).toBe(true)
    expect(build(world, HUMAN, world.map.cellAtOffset(1, 1)!, 'tower')).toBe(true) // three steps away
  })
})
