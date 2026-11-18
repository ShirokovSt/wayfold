import { describe, expect, it } from 'vitest'
import { Game } from '../game'
import { addVillage, handmadeWorld } from '../sim/handmade'
import { sendSquad } from '../sim/squads'
import { HUMAN, RIVAL } from '../sim/world'
import { TouchOrders } from './touchOrders'

function setup() {
  const game = new Game(1)
  const world = handmadeWorld(['.......', '......', '.......'])
  const capital = addVillage(world, 0, 0, HUMAN, 15, true)
  const other = addVillage(world, 0, 2, HUMAN, 9)
  const target = addVillage(world, 6, 0, RIVAL, 4).cell
  game.world = world
  return { game, world, capital, other, target, orders: new TouchOrders(game) }
}

describe('touch orders', () => {
  it('previews a group of villages and sends half from each only on confirmation', () => {
    const { world, orders, capital, other, target } = setup()
    orders.start(capital)
    orders.grouping = true
    orders.tap(other.cell)
    expect(orders.confirm()).toBe(false)
    orders.grouping = false
    orders.tap(target)
    expect(orders.draft?.paths).toHaveLength(2)
    expect(orders.count('half')).toBe(11)
    expect(world.orders).toEqual([])

    expect(orders.confirm()).toBe(true)
    expect(world.squads.map((squad) => squad.count)).toEqual([7, 4])
    expect(world.orders.map((order) => order.at)).toEqual([0, 0])
    expect(orders.confirm()).toBe(false)
  })

  it('rejects an impassable target and clears a draft after its last village is lost', () => {
    const { world, orders, capital, target } = setup()
    const water = world.map.cellAtOffset(2, 1)!
    water.terrain = 'water'
    orders.start(capital)
    orders.tap(water)
    expect(orders.draft?.paths).toEqual([])
    expect(orders.confirm()).toBe(false)
    orders.tap(target)
    capital.owner = RIVAL
    expect(orders.confirm()).toBe(false)
    expect(orders.draft).toBeNull()
    expect(world.orders).toEqual([])
  })

  it('redirects a live squad and discards the draft when playback starts', () => {
    const { game, world, orders, capital, other, target } = setup()
    const squad = sendSquad(world, HUMAN, capital, target)!
    orders.start(squad)
    orders.tap(other.cell)
    expect(orders.confirm()).toBe(true)
    expect(world.orders.at(-1)?.kind).toBe('redirect')
    orders.start(squad)
    orders.tap(target)
    game.watching = true
    expect(orders.confirm()).toBe(false)
    expect(orders.draft).toBeNull()
    expect(world.orders).toHaveLength(2)
  })
})
