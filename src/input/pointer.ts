import type { Game } from '../game'
import type { Layout } from '../render/layout'
import { findPath } from '../sim/pathfind'
import { sendSquad } from '../sim/squads'
import { type Cell, HUMAN, type Village } from '../sim/world'

export interface Drag {
  from: Village
  target: Cell | null
  path: Cell[] | null
}

// Press on your village, drag to the target, release: the squad sets off
export class PointerInput {
  drag: Drag | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly layout: Layout,
    private readonly game: Game,
  ) {
    canvas.addEventListener('pointerdown', (event) => this.press(event))
    canvas.addEventListener('pointermove', (event) => this.move(event))
    canvas.addEventListener('pointerup', () => this.release())
    canvas.addEventListener('pointercancel', () => (this.drag = null))
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.drag = null
    })
  }

  private press(event: PointerEvent): void {
    const village = this.cellAt(event)?.village
    if (this.game.paused || !village || village.owner !== HUMAN) return
    this.drag = { from: village, target: null, path: null }
    this.canvas.setPointerCapture(event.pointerId)
  }

  private move(event: PointerEvent): void {
    const cell = this.cellAt(event) ?? null
    this.canvas.style.cursor = cell?.village?.owner === HUMAN || this.drag ? 'pointer' : 'default'
    const drag = this.drag
    if (!drag || cell === drag.target) return
    drag.target = cell
    drag.path = cell && cell !== drag.from.cell ? findPath(this.game.world.map, drag.from.cell, cell) : null
  }

  private release(): void {
    const drag = this.drag
    this.drag = null
    if (drag?.target && drag.path && drag.from.owner === HUMAN) {
      sendSquad(this.game.world, HUMAN, drag.from, drag.target)
    }
  }

  private cellAt(event: PointerEvent): Cell | undefined {
    const rect = this.canvas.getBoundingClientRect()
    const hex = this.layout.screenToHex(event.clientX - rect.left, event.clientY - rect.top)
    return this.game.world.map.cellAt(hex)
  }
}
