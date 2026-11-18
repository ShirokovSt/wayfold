import type { Point } from '../core/hex'
import type { Game } from '../game'
import type { Layout } from '../render/layout'
import { findPath } from '../sim/pathfind'
import { type Share, redirectSquad, sendSquad, squadCell } from '../sim/squads'
import { type Cell, HUMAN, type Squad, type Village } from '../sim/world'

const SQUAD_GRAB_RADIUS = 0.6 // how close to a squad (in hex radii) a press picks it up
const DRAG_THRESHOLD = 5 // pixels the pointer must move before a press on empty ground becomes panning
const TOUCH_THRESHOLD = 9

// One gesture: the villages and squads gathered so far, and where they would go
export interface Drag {
  villages: Village[]
  squads: Squad[]
  target: Cell | null
  paths: Cell[][] // the route of every member that can reach the target
  share: Share // everyone in each village goes, or half while Ctrl is held
}

// Press on your village or squad, sweep over more of them, release on the target: they all set off,
// all of each village's people, or half of them with Ctrl (⌘ on a Mac) held.
// A mouse click inspects a tile. Touches pan anywhere, pinch to zoom, or select with a tap.
export class PointerInput {
  drag: Drag | null = null
  hover: Cell | null = null
  onPress: () => void = () => {}
  onTileClick: (cell: Cell) => void = () => {}
  onTouchTap: (cell: Cell | null, squad: Squad | null) => void = () => {}
  onTouchStart: () => void = () => {}
  onCameraMove: () => void = () => {}
  private pressed: Cell | null = null // a tile pressed outside of a drag
  private strayed = false // the drag has left the tile it started on, so coming back is not a click
  private pan: { x: number; y: number; moved: boolean } | null = null
  private touches = new Map<number, Point>()
  private touchMoved = false

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly layout: Layout,
    private readonly game: Game,
  ) {
    // The canvas uses pointer events for taps and pinches. Cancel the browser's own touch gestures here.
    canvas.addEventListener('touchstart', (event) => {
      if (event.cancelable) event.preventDefault()
    }, { passive: false })
    canvas.addEventListener('pointerdown', (event) => this.press(event))
    canvas.addEventListener('pointermove', (event) => this.move(event))
    canvas.addEventListener('pointerup', (event) => this.release(event))
    for (const type of ['pointercancel', 'lostpointercapture'] as const) {
      canvas.addEventListener(type, (event) => {
        if (event.pointerType === 'touch') {
          if (this.touches.delete(event.pointerId)) this.touchMoved = true
        } else {
          this.clearMouse()
        }
      })
    }
    canvas.addEventListener('pointerleave', () => (this.hover = null))
    // Ctrl can be pressed or let go in the middle of a drag. Not Shift: pressed often, it calls up Windows' sticky keys
    for (const type of ['keydown', 'keyup'] as const) {
      window.addEventListener(type, (event) => {
        if (this.drag && (event.key === 'Control' || event.key === 'Meta')) this.drag.share = shareOf(event)
      })
    }
  }

  cancel(): void {
    this.clearMouse()
    this.touches.clear()
    this.touchMoved = false
    this.hover = null
  }

  private clearMouse(): void {
    this.drag = null
    this.pan = null
    this.pressed = null
  }

  private press(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      if (this.touches.size === 0) {
        this.clearMouse()
        this.hover = null
        this.touchMoved = false
        this.onTouchStart()
      } else {
        this.touchMoved = true
      }
      this.canvas.setPointerCapture(event.pointerId)
      this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      return
    }
    if (this.touches.size || event.button !== 0) return
    this.onPress()
    this.canvas.setPointerCapture(event.pointerId)
    this.drag = { villages: [], squads: [], target: null, paths: [], share: shareOf(event) }
    this.strayed = false
    // Orders work during the pause too: plan calmly, then let it run
    if (this.game.watching || this.game.world.winner !== null || !this.gather(event)) {
      this.drag = null
      this.pressed = this.cellAt(event) ?? null
      this.pan = { x: event.clientX, y: event.clientY, moved: false }
    }
  }

  private move(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      this.moveTouch(event)
      return
    }
    if (this.touches.size) return
    if (this.pan) {
      const dx = event.clientX - this.pan.x
      const dy = event.clientY - this.pan.y
      if (this.pan.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        this.pan = { x: event.clientX, y: event.clientY, moved: true }
        this.layout.panBy(dx, dy)
        this.onCameraMove()
      }
    }
    const cell = this.cellAt(event) ?? null
    this.hover = cell
    const drag = this.drag
    // Villages, buildings and dens can be clicked for a card about them
    const clickable = cell && (cell.village || cell.building || cell.lair)
    this.canvas.style.cursor = drag || clickable || this.ownSquadAt(event) ? 'pointer' : 'default'
    if (!drag) return
    if (cell !== drag.villages[0]?.cell) this.strayed = true
    drag.share = shareOf(event)
    const joined = this.gather(event)
    if (joined || cell !== drag.target) {
      drag.target = cell
      drag.paths = this.routes(drag)
    }
  }

  private release(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      const start = this.touches.get(event.pointerId)
      const tapped = start && this.touches.size === 1 && !this.touchMoved &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) <= TOUCH_THRESHOLD
      this.touches.delete(event.pointerId)
      if (tapped) this.onTouchTap(this.cellAt(event) ?? null, this.ownSquadAt(event, true))
      return
    }
    if (event.button !== 0 || this.touches.size) return
    const drag = this.drag
    const pressed = this.pressed
    const panned = this.pan?.moved ?? false
    this.clearMouse()
    if (!drag) {
      if (!panned && pressed && pressed === this.cellAt(event)) this.onTileClick(pressed)
      return
    }
    // Released on the only village it started from without leaving it: a click, e.g. to upgrade the village.
    // Led away and brought back, it is a change of mind: nothing happens
    const releasedOn = drag.target ?? this.cellAt(event)
    if (drag.squads.length === 0 && drag.villages.length === 1 && drag.villages[0].cell === releasedOn) {
      if (!this.strayed) this.onTileClick(releasedOn)
      return
    }
    if (!drag.target) return
    const world = this.game.world
    // The village you release on is the destination, not a member of the group
    for (const village of drag.villages) {
      if (village.cell !== drag.target) sendSquad(world, HUMAN, village, drag.target, shareOf(event))
    }
    for (const squad of drag.squads) redirectSquad(world, HUMAN, squad, drag.target)
  }

  private moveTouch(event: PointerEvent): void {
    const before = this.touches.get(event.pointerId)
    if (!before) return
    const after = { x: event.clientX, y: event.clientY }
    const dx = after.x - before.x
    const dy = after.y - before.y
    if (this.touches.size === 2) {
      const other = [...this.touches.entries()].find(([id]) => id !== event.pointerId)![1]
      const distance = Math.hypot(before.x - other.x, before.y - other.y)
      const nextDistance = Math.hypot(after.x - other.x, after.y - other.y)
      const rect = this.canvas.getBoundingClientRect()
      if (distance > 1 && nextDistance > 1) {
        this.layout.zoomAt((before.x + other.x) / 2 - rect.left, (before.y + other.y) / 2 - rect.top, nextDistance / distance)
      }
      this.layout.panBy(dx / 2, dy / 2)
    } else if (this.touches.size === 1) {
      if (!this.touchMoved && Math.hypot(dx, dy) <= TOUCH_THRESHOLD) return
      this.touchMoved = true
      this.layout.panBy(dx, dy)
    }
    this.touches.set(event.pointerId, after)
    this.onCameraMove()
  }

  // Adds your village or squad under the pointer to the group; true if someone joined
  private gather(event: PointerEvent): boolean {
    const drag = this.drag!
    const village = this.ownVillageAt(event)
    const squad = this.ownSquadAt(event)
    // An empty village has nobody to send, so a squad walking out of it is picked instead
    if (village && (village.population >= 1 || !squad)) {
      if (drag.villages.includes(village)) return false
      drag.villages.push(village)
      return true
    }
    if (!squad || drag.squads.includes(squad)) return false
    drag.squads.push(squad)
    return true
  }

  private routes(drag: Drag): Cell[][] {
    const target = drag.target
    if (!target) return []
    const map = this.game.world.map
    const starts = [
      ...drag.villages.filter((v) => v.cell !== target).map((v) => v.cell),
      ...drag.squads.filter((s) => this.game.world.squads.includes(s)).map(squadCell),
    ]
    const paths = starts.map((start) => (start === target ? [start] : findPath(map, start, target)))
    return paths.filter((path) => path !== null)
  }

  private ownVillageAt(event: PointerEvent): Village | null {
    const village = this.cellAt(event)?.village
    return village?.owner === HUMAN ? village : null
  }

  // The nearest of your squads within reach of the pointer
  private ownSquadAt(event: PointerEvent, touch = false): Squad | null {
    const point = this.layout.fromScreen(...this.canvasPoint(event))
    let best: Squad | null = null
    let bestDistance = touch ? Math.min(1, Math.max(SQUAD_GRAB_RADIUS, 12 / this.layout.size)) : SQUAD_GRAB_RADIUS
    for (const squad of this.game.world.squads) {
      const distance = Math.hypot(squad.x - point.x, squad.y - point.y)
      if (squad.owner === HUMAN && distance < bestDistance) {
        best = squad
        bestDistance = distance
      }
    }
    return best
  }

  private cellAt(event: PointerEvent): Cell | undefined {
    return this.game.world.map.cellAt(this.layout.screenToHex(...this.canvasPoint(event)))
  }

  private canvasPoint(event: PointerEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect()
    return [event.clientX - rect.left, event.clientY - rect.top]
  }
}

function shareOf(event: PointerEvent | KeyboardEvent): Share {
  return event.ctrlKey || event.metaKey ? 'half' : 'all'
}
