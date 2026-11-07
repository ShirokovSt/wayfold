import { describe, expect, it } from 'vitest'
import { findPath } from './pathfind'
import { addVillage, testWorld } from './testWorld.testing'

describe('findPath', () => {
  it('goes around mountains', () => {
    const { map } = testWorld([
      '......',
      '.mm..',
      '......',
    ])
    const path = findPath(map, map.cellAtOffset(0, 1)!, map.cellAtOffset(4, 1)!)!
    expect(path.every((cell) => cell.terrain === 'field')).toBe(true)
    expect(path.at(-1)).toBe(map.cellAtOffset(4, 1))
  })

  it('prefers a detour over fields to a straight way through forest', () => {
    const { map } = testWorld([
      '......',
      '.ff..',
      '......',
    ])
    const path = findPath(map, map.cellAtOffset(0, 1)!, map.cellAtOffset(4, 1)!)!
    expect(path.some((cell) => cell.terrain === 'forest')).toBe(false)
  })

  it('returns null when the goal is walled off or impassable', () => {
    const { map } = testWorld([
      '..w..',
      '.ww.',
      '..w..',
    ])
    expect(findPath(map, map.cellAtOffset(0, 0)!, map.cellAtOffset(4, 0)!)).toBeNull()
    expect(findPath(map, map.cellAtOffset(0, 0)!, map.cellAtOffset(2, 0)!)).toBeNull()
  })

  it('walks around villages that are not the goal', () => {
    const world = testWorld([
      '.....',
      '....',
      '.....',
    ])
    const blocker = addVillage(world, 2, 0, null, 5)
    const path = findPath(world.map, world.map.cellAtOffset(0, 0)!, world.map.cellAtOffset(4, 0)!)!
    expect(path).not.toContain(blocker.cell)
    expect(findPath(world.map, world.map.cellAtOffset(0, 0)!, blocker.cell)!.at(-1)).toBe(blocker.cell)
  })
})
