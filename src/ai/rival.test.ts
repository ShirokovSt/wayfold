import { describe, expect, it } from 'vitest'
import { createRandom } from '../core/rng'
import { addVillage, handmadeWorld } from '../sim/handmade'
import { createWorld } from '../sim/mapgen'
import { TICK_SECONDS } from '../sim/rules'
import { sendSquad } from '../sim/squads'
import { tick } from '../sim/tick'
import { HUMAN, MAP_TYPES, RIVAL } from '../sim/world'
import { Rival } from './rival'

describe('rival AI', () => {
  it('waits a little, then starts expanding', () => {
    const world = createWorld(5)
    const rival = new Rival(RIVAL, createRandom(1))
    const play = (seconds: number) => {
      for (let t = 0; t < seconds; t += TICK_SECONDS) {
        rival.update(world, TICK_SECONDS)
        tick(world, TICK_SECONDS)
      }
    }
    play(9)
    expect(world.squads).toHaveLength(0)
    play(40)
    expect(world.villages.filter((v) => v.owner === RIVAL).length).toBeGreaterThan(1)
  })

  it('leads a squad left with no village at the nearest one it can take', () => {
    const world = handmadeWorld(['.......', '......', '.......'])
    const home = addVillage(world, 6, 0, RIVAL, 6)
    const weak = addVillage(world, 0, 2, null, 1)
    addVillage(world, 0, 0, HUMAN, 20)
    const rival = new Rival(RIVAL, createRandom(1))
    sendSquad(world, RIVAL, home, world.map.cellAtOffset(4, 2)!)
    home.owner = HUMAN
    for (let t = 0; t < 30; t += TICK_SECONDS) {
      rival.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
    }
    expect(weak.owner).toBe(RIVAL)
  })

  it('hunts down the squad of an enemy left with no village, and ends the match', () => {
    const world = handmadeWorld(['.......', '......', '.......'])
    const home = addVillage(world, 0, 0, HUMAN, 4)
    addVillage(world, 6, 2, RIVAL, 20)
    const rival = new Rival(RIVAL, createRandom(1))
    sendSquad(world, HUMAN, home, world.map.cellAtOffset(2, 2)!)
    home.owner = RIVAL
    for (let t = 0; t < 40 && world.winner === null; t += TICK_SECONDS) {
      rival.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
    }
    expect(world.squads.filter((squad) => squad.owner === HUMAN)).toHaveLength(0)
    expect(world.winner).toBe(RIVAL)
  })

  it('cuts off a homeless squad on the run instead of trailing behind it', () => {
    const world = handmadeWorld(['.............', '............', '.............', '............', '.............'])
    const home = addVillage(world, 12, 2, HUMAN, 8)
    addVillage(world, 3, 0, RIVAL, 20)
    addVillage(world, 6, 4, RIVAL, 20)
    const rival = new Rival(RIVAL, createRandom(1), 'hard')
    for (let t = 0; t < 6; t += TICK_SECONDS) tick(world, TICK_SECONDS) // the rival's first move is due
    const prey = sendSquad(world, HUMAN, home, world.map.cellAtOffset(0, 2)!)!
    home.owner = RIVAL
    let caughtAt = Infinity
    for (let t = 0; t < 20 && caughtAt === Infinity; t += TICK_SECONDS) {
      rival.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
      if (!world.squads.includes(prey)) caughtAt = t
    }
    expect(caughtAt).toBeLessThan(10) // the prey needs 12 seconds to get where it runs
  })

  // A whole match takes a few seconds to simulate, hence the longer time limit
  it.each(MAP_TYPES)('two AIs play a whole match to the end (%s)', (type) => {
    const world = createWorld(1, { size: 'medium', type })
    const players = [new Rival(HUMAN, createRandom(11)), new Rival(RIVAL, createRandom(21))]
    while (world.winner === null && world.time < 20 * 60) {
      for (const player of players) player.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
    }
    // Not an assertion on balance, just that the rules keep working for a full match
    expect(world.time).toBeGreaterThan(10)
  }, 30_000)

  // The trick of sending a squad at a village and taking it once the rival has sent everyone away
  it.each([
    ['normal', true],
    ['easy', false],
  ] as const)('a %s rival keeps a garrison against a squad heading its way: %s', (difficulty, keeps) => {
    const world = handmadeWorld(['..........', '.........', '..........'])
    const home = addVillage(world, 0, 1, HUMAN, 20, true)
    const village = addVillage(world, 7, 1, RIVAL, 24, true)
    addVillage(world, 9, 0, null, 3)
    sendSquad(world, HUMAN, home, village.cell, 'half')
    new Rival(RIVAL, createRandom(1), difficulty).update(world, 30)
    expect(world.squads.some((squad) => squad.owner === RIVAL)).toBe(true) // it still went for the neutral village
    expect(village.population >= 11).toBe(keeps) // ten people are coming: enough stayed home
  })

  it.each([HUMAN, RIVAL])('a hard rival beats an easy one (hard plays %i)', (hard) => {
    const world = createWorld(2, { size: 'medium', type: 'continent' })
    const players = world.players.map((player) => new Rival(player, createRandom(player + 5), player === hard ? 'hard' : 'easy'))
    while (world.winner === null && world.time < 20 * 60) {
      for (const player of players) player.update(world, TICK_SECONDS)
      tick(world, TICK_SECONDS)
    }
    expect(world.winner).toBe(hard)
  }, 30_000)
})
