import type { Game } from '../game'
import type { Layout } from '../render/layout'
import { findPath } from '../sim/pathfind'
import { redirectSquad, sendSquad, squadCell } from '../sim/squads'
import { type Cell, HUMAN, type Squad, type Village } from '../sim/world'

const SQUAD_GRAB_RADIUS = 0.6 // how close to a squad (in hex radii) a press picks it up

// One gesture: the villages and squads gathered so far, and where they would go
export interface Drag {
  villages: Village[]
  squads: Squad[]
  target: Cell | null
  paths: Cell[][] // the route of every member that can reach the target
}

// Press on your village or squad, sweep over more of them, release on the target: they all set off.
// A plain click on any other tile is passed on, e.g. to open the build menu
export class PointerInput {
  drag: Drag | null = null
  hover: Cell | null = null
  onPress: () => void = () => {}
  onTileClick: (cell: Cell) => void = () => {}
  private pressed: Cell | null = null // a tile pressed outside of a drag

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly layout: Layout,
    private readonly game: Game,
  ) {
    canvas.addEventListener('pointerdown', (event) => this.press(event))
    canvas.addEventListener('pointermove', (event) => this.move(event))
    canvas.addEventListener('pointerup', (event) => this.release(event))
    canvas.addEventListener('pointercancel', () => (this.drag = null))
    canvas.addEventListener('pointerleave', () => (this.hover = null))
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.drag = null
    })
  }

  private press(event: PointerEvent): void {
    this.onPress()
    // Orders work during the pause too: plan calmly, then let it run
    if (this.game.world.winner !== null) return
    this.drag = { villages: [], squads: [], target: null, paths: [] }
    if (!this.gather(event)) {
      this.drag = null
      this.pressed = this.cellAt(event) ?? null
      return
    }
    this.canvas.setPointerCapture(event.pointerId)
  }

  private move(event: PointerEvent): void {
    const cell = this.cellAt(event) ?? null
    this.hover = cell
    const drag = this.drag
    this.canvas.style.cursor = drag || this.ownVillageAt(event) || this.ownSquadAt(event) ? 'pointer' : 'default'
    if (!drag) return
    const joined = this.gather(event)
    if (joined || cell !== drag.target) {
      drag.target = cell
      drag.paths = this.routes(drag)
    }
  }

  private release(event: PointerEvent): void {
    const drag = this.drag
    const pressed = this.pressed
    this.drag = null
    this.pressed = null
    if (!drag) {
      if (pressed && pressed === this.cellAt(event)) this.onTileClick(pressed)
      return
    }
    if (!drag.target) return
    const world = this.game.world
    // The village you release on is the destination, not a member of the group
    for (const village of drag.villages) {
      if (village.cell !== drag.target) sendSquad(world, HUMAN, village, drag.target)
    }
    for (const squad of drag.squads) redirectSquad(world, HUMAN, squad, drag.target)
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
  private ownSquadAt(event: PointerEvent): Squad | null {
    const point = this.layout.fromScreen(...this.canvasPoint(event))
    let best: Squad | null = null
    let bestDistance = SQUAD_GRAB_RADIUS
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
