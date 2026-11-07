import type { Drag } from '../input/pointer'
import { HUMAN, type Squad, type World } from '../sim/world'
import { drawDecor, drawGround, drawTable, drawTerritory, hexPath, tileCenter } from './board'
import { drawBadge, drawPerson, drawVillage } from './figures'
import { Layout } from './layout'
import { ownerTone } from './palette'

// Where the walkers of a squad stand around its position, in tile sizes; at most this many are drawn
const FORMATION = [
  { x: 0, y: 0 },
  { x: -0.2, y: -0.1 },
  { x: 0.2, y: -0.1 },
  { x: -0.12, y: 0.13 },
  { x: 0.13, y: 0.13 },
  { x: -0.32, y: 0.06 },
  { x: 0.33, y: 0.05 },
]

export class Renderer {
  readonly layout = new Layout()
  private readonly ctx: CanvasRenderingContext2D
  // The board itself never changes during a match, so it is drawn once into these layers
  private readonly ground = document.createElement('canvas')
  private readonly decor = document.createElement('canvas')
  private width = 0
  private height = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private world: World,
  ) {
    this.ctx = canvas.getContext('2d')!
    this.resize()
  }

  setWorld(world: World): void {
    this.world = world
    this.drawLayers()
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1
    this.width = this.canvas.clientWidth
    this.height = this.canvas.clientHeight
    for (const canvas of [this.canvas, this.ground, this.decor]) {
      canvas.width = Math.round(this.width * dpr)
      canvas.height = Math.round(this.height * dpr)
    }
    this.layout.fit(this.world.map, this.width, this.height)
    this.drawLayers()
  }

  // `alpha` is how far we are between the last tick and the next one, for smooth movement
  draw(alpha: number, time: number, drag: Drag | null): void {
    const ctx = this.ctx
    const dpr = this.canvas.width / this.width
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.drawImage(this.ground, 0, 0, this.width, this.height)
    drawTerritory(ctx, this.world.map, this.layout)
    ctx.drawImage(this.decor, 0, 0, this.width, this.height)
    if (drag) this.drawDrag(drag)

    const size = this.layout.size
    for (const village of this.world.villages) {
      const { x, y } = tileCenter(this.layout, village.cell)
      drawVillage(ctx, x, y, size, ownerTone(village.owner), time)
    }
    const squads = [...this.world.squads].sort((a, b) => a.y - b.y)
    for (const squad of squads) this.drawSquad(squad, alpha, time)
    for (const village of this.world.villages) {
      const { x, y } = tileCenter(this.layout, village.cell)
      drawBadge(ctx, x, y + size * 0.55, String(Math.floor(village.population)), size, ownerTone(village.owner))
    }
  }

  private drawLayers(): void {
    const dpr = this.canvas.width / this.width
    const ground = this.ground.getContext('2d')!
    const decor = this.decor.getContext('2d')!
    for (const ctx of [ground, decor]) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, this.width, this.height)
    }
    drawTable(ground, this.width, this.height)
    drawGround(ground, this.world.map, this.layout)
    drawDecor(decor, this.world.map, this.layout)
  }

  private drawSquad(squad: Squad, alpha: number, time: number): void {
    const size = this.layout.size
    const tone = ownerTone(squad.owner)
    const { x, y } = this.layout.toScreen(
      squad.prevX + (squad.x - squad.prevX) * alpha,
      squad.prevY + (squad.y - squad.prevY) * alpha,
    )
    const walkers = FORMATION.slice(0, squad.count).sort((a, b) => a.y - b.y)
    walkers.forEach((spot, i) => {
      drawPerson(this.ctx, x + spot.x * size, y + spot.y * size + size * 0.15, size, tone, time * 9 + i * 1.7 + squad.id)
    })
    if (squad.count > 1) drawBadge(this.ctx, x, y - size * 0.38, String(squad.count), size * 0.8, tone)
  }

  // The route a squad would take, shown while dragging
  private drawDrag(drag: Drag): void {
    const ctx = this.ctx
    const size = this.layout.size
    const tone = ownerTone(HUMAN)
    ctx.lineWidth = size * 0.07
    ctx.strokeStyle = tone.light
    hexPath(ctx, tileCenter(this.layout, drag.from.cell), size * 0.86)
    ctx.stroke()
    if (!drag.path) return

    ctx.beginPath()
    for (const cell of drag.path) {
      const { x, y } = tileCenter(this.layout, cell)
      ctx.lineTo(x, y)
    }
    ctx.setLineDash([size * 0.12, size * 0.16])
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = size * 0.1
    ctx.strokeStyle = tone.dark
    ctx.stroke()
    ctx.setLineDash([])
    hexPath(ctx, tileCenter(this.layout, drag.path[drag.path.length - 1]), size * 0.86)
    ctx.lineWidth = size * 0.07
    ctx.stroke()
  }
}
