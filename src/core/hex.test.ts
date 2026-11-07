import { describe, expect, it } from 'vitest'
import { DIRECTIONS, addHex, hexCorner, hexDistance, hexToPoint, pointToHex } from './hex'

describe('hex math', () => {
  const center = { q: 2, r: -1 }

  it('neighbors are one step away', () => {
    for (const direction of DIRECTIONS) expect(hexDistance(center, addHex(center, direction))).toBe(1)
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3)
  })

  it('converts a hex to a point and back', () => {
    for (const hex of [center, { q: -4, r: 7 }, { q: 0, r: 0 }]) {
      expect(pointToHex(hexToPoint(hex, 30), 30)).toEqual(hex)
    }
  })

  it('finds the hex under a point near its edge', () => {
    const point = hexToPoint(center, 1)
    expect(pointToHex({ x: point.x + 0.8, y: point.y }, 1)).toEqual(center)
  })

  it('neighbor i lies across the edge between corners i and i + 1', () => {
    const origin = hexToPoint(center, 1)
    DIRECTIONS.forEach((direction, i) => {
      const a = hexCorner(origin, 1, i)
      const b = hexCorner(origin, 1, i + 1)
      const neighbor = hexToPoint(addHex(center, direction), 1)
      const edgeMiddle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      // The edge middle is exactly halfway between the two centers
      expect(edgeMiddle.x).toBeCloseTo((origin.x + neighbor.x) / 2)
      expect(edgeMiddle.y).toBeCloseTo((origin.y + neighbor.y) / 2)
    })
  })
})
