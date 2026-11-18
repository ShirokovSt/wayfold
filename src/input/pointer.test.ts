import { afterEach, describe, expect, it, vi } from 'vitest'
import { Game } from '../game'
import { Layout } from '../render/layout'
import { HUMAN } from '../sim/world'
import { PointerInput } from './pointer'

afterEach(() => vi.unstubAllGlobals())

function setup() {
  const game = new Game(15)
  const capital = game.world.villages.find((village) => village.owner === HUMAN)!
  const layout = new Layout()
  layout.touch = true
  layout.fit(game.world.map, 360, 600)
  layout.frameCapital(capital.cell.hex)
  const canvas = Object.assign(new EventTarget(), {
    setPointerCapture: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  })
  vi.stubGlobal('window', new EventTarget())
  const input = new PointerInput(canvas as unknown as HTMLCanvasElement, layout, game)
  input.onTouchTap = vi.fn()
  const touch = (type: string, pointerId: number, clientX: number, clientY: number) => {
    canvas.dispatchEvent(Object.assign(new Event(type), { pointerId, pointerType: 'touch', clientX, clientY }))
  }
  return { game, capital, layout, input, canvas, touch }
}

describe('touch gestures', () => {
  it('claims native touches on the canvas while handling a double tap as two selections', () => {
    const { capital, layout, input, canvas, touch } = setup()
    const { x, y } = layout.hexToScreen(capital.cell.hex)
    const zoom = layout.zoom
    for (const id of [1, 2]) {
      const start = new Event('touchstart', { cancelable: true })
      canvas.dispatchEvent(start)
      expect(start.defaultPrevented).toBe(true)
      touch('pointerdown', id, x, y)
      touch('pointerup', id, x, y)
    }
    expect(input.onTouchTap).toHaveBeenCalledTimes(2)
    expect(layout.zoom).toBe(zoom)
  })

  it('taps a village and can pan from the same village without selecting it', () => {
    const { game, capital, layout, input, touch } = setup()
    const { x, y } = layout.hexToScreen(capital.cell.hex)
    touch('pointerdown', 1, x, y)
    touch('pointermove', 1, x + 3, y)
    touch('pointerup', 1, x + 3, y)
    expect(input.onTouchTap).toHaveBeenCalledExactlyOnceWith(capital.cell, null)

    touch('pointerdown', 2, x, y)
    touch('pointermove', 2, x + 45, y)
    touch('pointerup', 2, x + 45, y)
    expect(layout.hexToScreen(capital.cell.hex).x).toBeGreaterThan(x)
    expect(input.onTouchTap).toHaveBeenCalledTimes(1)
    expect(game.world.orders).toEqual([])
  })

  it('never converts the last finger of a pinch or a canceled gesture into a tap', () => {
    const { layout, input, touch } = setup()
    const zoom = layout.zoom
    touch('pointerdown', 1, 120, 280)
    touch('pointerdown', 2, 220, 280)
    touch('pointermove', 2, 252, 280)
    touch('pointerup', 2, 252, 280)
    touch('pointerup', 1, 120, 280)
    touch('pointerdown', 3, 180, 300)
    touch('pointercancel', 3, 180, 300)
    touch('pointerup', 3, 180, 300)
    expect(layout.zoom).toBeGreaterThan(zoom)
    expect(input.onTouchTap).not.toHaveBeenCalled()
  })

  it('holds the same world center and tile size when the board changes orientation', () => {
    const { game, capital, layout } = setup()
    const size = layout.size
    layout.fit(game.world.map, 744, 350)
    const center = layout.hexToScreen(capital.cell.hex)
    expect(center.x).toBeCloseTo(372)
    expect(center.y).toBeCloseTo(175)
    expect(layout.size).toBeCloseTo(size)
    layout.resetCamera()
    expect(layout.zoom).toBe(1)
  })
})
