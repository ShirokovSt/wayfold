import { describe, expect, it } from 'vitest'
import { en, ru } from '../i18n/strings'
import { build } from '../sim/economy'
import { addVillage, handmadeWorld } from '../sim/handmade'
import { createWorld } from '../sim/mapgen'
import { NAME_ENDINGS, NAME_ROOTS } from '../sim/names'
import { BUILDING_COST } from '../sim/rules'
import { HUMAN, RIVAL } from '../sim/world'
import { describeTile, linkedVillage, villageName } from './tileInfo'

describe('village names', () => {
  it('are spelled in both languages, each root with names no other root has', () => {
    for (const strings of [en, ru]) {
      const byRoot = Array.from({ length: NAME_ROOTS }, (_, root) =>
        new Set(Array.from({ length: NAME_ENDINGS }, (_, ending) => strings.villageName(root * NAME_ENDINGS + ending))))
      for (const names of byRoot) for (const name of names) expect(name).toMatch(/^\S.*\S$/)
      const all = byRoot.flatMap((names) => [...names])
      expect(new Set(all).size).toBe(all.length)
    }
  })

  it('give every village of a map a root of its own, the same for the same seed', () => {
    const settings = { type: 'continent', size: 'large', season: 'summer', beasts: 'none', players: 4 } as const
    const names = createWorld(5, settings).villages.map((village) => village.name)
    const roots = names.map((name) => Math.floor(name / NAME_ENDINGS))
    expect(new Set(roots).size).toBe(names.length)
    expect(createWorld(5, settings).villages.map((village) => village.name)).toEqual(names)
  })
})

describe('tile cards', () => {
  it("tie a farm to the village whose estate it is in", () => {
    const world = handmadeWorld(['.......', '......', '.......'])
    const home = addVillage(world, 0, 0, HUMAN, 10)
    addVillage(world, 6, 2, RIVAL, 10)
    const field = world.map.cellAtOffset(1, 0)!
    field.owner = HUMAN
    world.gold[HUMAN] = BUILDING_COST.farm
    expect(build(world, HUMAN, field, 'farm')).toBe(true)
    expect(linkedVillage(world, field)).toBe(home)
    const card = describeTile(world, field)!
    expect(card.rows[0][0].text).toContain(villageName(home))
    expect(describeTile(world, home.cell)!.rows[1][0]).toEqual({ icon: 'farm', text: '1' })
  })

  it('tell how strong a village you do not own is', () => {
    const world = handmadeWorld(['.......', '......', '.......'])
    const town = addVillage(world, 6, 2, RIVAL, 12)
    town.town = true
    const items = describeTile(world, town.cell)!.rows.flat()
    expect(items.map((item) => item.text)).toContain(en.defence(24))
    expect(items.some((item) => item.icon === 'gold')).toBe(false)
  })
})
