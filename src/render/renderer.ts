import type { Drag } from '../input/pointer'
import { HUMAN, type Squad, type World } from '../sim/world'
import { drawDecor, drawGround, drawTable, drawTerritory, hexPath, tileCenter } from './board'
import { drawBadge, drawCrown, drawPerson, drawVillage } from './figures'
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

  // `alpha` is how far we are between the last tick and the next one, for smooth movement;
  // on pause the routes of your squads are shown, to plan the next orders
  draw(alpha: number, time: number, drag: Drag | null, showRoutes: boolean): void {
    const ctx = this.ctx
    const dpr = this.canvas.width / this.width
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.drawImage(this.ground, 0, 0, this.width, this.height)
    drawTerritory(ctx, this.world.map, this.layout)
    ctx.drawImage(this.decor, 0, 0, this.width, this.height)
    if (showRoutes) this.drawRoutes()
    if (drag) this.drawDrag(drag)

    const size = this.layout.size
    for (const village of this.world.villages) {
      const { x, y } = tileCenter(this.layout, village.cell)
      drawVillage(ctx, x, y, size, ownerTone(village.owner), time)
      if (village.capital) drawCrown(ctx, x - size * 0.05, y - size * 0.5, size, time)
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

  // Where your squads are heading: from their current spot along the rest of the path
  private drawRoutes(): void {
    const ctx = this.ctx
    const size = this.layout.size
    ctx.setLineDash([size * 0.08, size * 0.14])
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = size * 0.06
    ctx.strokeStyle = ownerTone(HUMAN).dark
    for (const squad of this.world.squads) {
      if (squad.owner !== HUMAN) continue
      const start = this.layout.toScreen(squad.x, squad.y)
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      for (const cell of squad.path.slice(squad.step + 1)) {
        const { x, y } = tileCenter(this.layout, cell)
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  // While dragging: rings around the gathered villages and squads, and the routes they would take
  private drawDrag(drag: Drag): void {
    const ctx = this.ctx
    const size = this.layout.size
    const tone = ownerTone(HUMAN)
    ctx.lineWidth = size * 0.07
    ctx.strokeStyle = tone.light
    for (const village of drag.villages) {
      hexPath(ctx, tileCenter(this.layout, village.cell), size * 0.86)
      ctx.stroke()
    }
    for (const squad of drag.squads) {
      const { x, y } = this.layout.toScreen(squad.x, squad.y)
      ctx.beginPath()
      ctx.ellipse(x, y + size * 0.1, size * 0.45, size * 0.3, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.setLineDash([size * 0.12, size * 0.16])
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = size * 0.1
    ctx.strokeStyle = tone.dark
    for (const path of drag.paths) {
      ctx.beginPath()
      for (const cell of path) {
        const { x, y } = tileCenter(this.layout, cell)
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.setLineDash([])
    if (drag.target && drag.paths.length > 0) {
      hexPath(ctx, tileCenter(this.layout, drag.target), size * 0.86)
      ctx.lineWidth = size * 0.07
      ctx.stroke()
    }
  }
}
