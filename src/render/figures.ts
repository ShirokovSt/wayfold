import { ellipse } from './board'
import type { Point } from '../core/hex'
import type { BuildingKind } from '../sim/world'
import { FARM, GOLD, ROCK, SHADOW, STEEL, STONE, type Tone, WOOD } from './palette'

// Village pieces: three little houses with roofs in the owner's color and a flag;
// a town stands inside a stone wall, with a keep at the back, clear of the capital's crown
export function drawVillage(
  ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: Tone, time: number, town = false,
): void {
  ellipse(ctx, x, y + size * 0.1, size * (town ? 0.6 : 0.44), size * (town ? 0.26 : 0.17), SHADOW)
  if (town) drawWall(ctx, x, y, size)
  drawFlag(ctx, x + size * 0.4, y - size * 0.02, size, tone, time)
  if (town) drawKeep(ctx, x - size * 0.33, y - size * 0.02, size, tone)
  drawHouse(ctx, x - size * 0.25, y - size * 0.1, size * 0.33, tone)
  drawHouse(ctx, x + size * 0.17, y - size * 0.17, size * 0.3, tone)
  drawHouse(ctx, x - size * 0.02, y + size * 0.18, size * 0.4, tone)
}

// A low round wall: its front face, the top and battlements along the front edge
function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const cy = y + size * 0.05
  const rx = size * 0.56
  const ry = size * 0.25
  const h = size * 0.1
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.025
  ctx.strokeStyle = STONE.dark
  ctx.beginPath()
  ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI)
  ctx.lineTo(x - rx, cy + h)
  ctx.ellipse(x, cy + h, rx, ry, 0, Math.PI, 0, true)
  ctx.closePath()
  ctx.fillStyle = ROCK.dark
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = STONE.main
  ctx.fill()
  ctx.stroke()
  for (let i = 0; i <= 6; i++) {
    const angle = Math.PI * (0.08 + (0.84 * i) / 6)
    const bx = x + rx * Math.cos(angle)
    const by = cy + ry * Math.sin(angle)
    ctx.fillRect(bx - size * 0.04, by - size * 0.07, size * 0.08, size * 0.07)
    ctx.strokeRect(bx - size * 0.04, by - size * 0.07, size * 0.08, size * 0.07)
  }
}

// A tall stone tower with a window and a pointed roof in the owner's color
function drawKeep(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: Tone): void {
  const w = size * 0.2
  const top = y - size * 0.52
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.025
  ctx.fillStyle = STONE.main
  ctx.strokeStyle = STONE.dark
  ctx.fillRect(x - w / 2, top, w, y - top)
  ctx.strokeRect(x - w / 2, top, w, y - top)
  ctx.fillStyle = WOOD.door
  ctx.fillRect(x - size * 0.03, top + size * 0.08, size * 0.06, size * 0.09)
  ctx.beginPath()
  ctx.moveTo(x - w * 0.7, top)
  ctx.lineTo(x, top - size * 0.24)
  ctx.lineTo(x + w * 0.7, top)
  ctx.closePath()
  ctx.fillStyle = tone.main
  ctx.strokeStyle = tone.dark
  ctx.fill()
  ctx.stroke()
}

function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, tone: Tone): void {
  const wall = width * 0.55
  ctx.lineJoin = 'round'
  ctx.lineWidth = width * 0.08
  ctx.strokeStyle = WOOD.roof
  ctx.fillStyle = WOOD.wall
  ctx.fillRect(x - width / 2, y - wall, width, wall)
  ctx.strokeRect(x - width / 2, y - wall, width, wall)
  ctx.fillStyle = WOOD.door
  ctx.fillRect(x - width * 0.1, y - wall * 0.55, width * 0.2, wall * 0.55)

  ctx.beginPath()
  ctx.moveTo(x - width * 0.65, y - wall + width * 0.04)
  ctx.lineTo(x, y - wall - width * 0.5)
  ctx.lineTo(x + width * 0.65, y - wall + width * 0.04)
  ctx.closePath()
  ctx.fillStyle = tone.main
  ctx.strokeStyle = tone.dark
  ctx.fill()
  ctx.stroke()
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: Tone, time: number): void {
  const top = y - size * 0.72
  const wave = Math.sin(time * 4 + x) * size * 0.04
  ctx.strokeStyle = WOOD.trunk
  ctx.lineWidth = size * 0.04
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, top)
  ctx.stroke()
  ctx.lineCap = 'butt'

  ctx.beginPath()
  ctx.moveTo(x, top)
  ctx.quadraticCurveTo(x + size * 0.15, top - wave, x + size * 0.3, top + size * 0.07 + wave)
  ctx.quadraticCurveTo(x + size * 0.15, top + size * 0.16 - wave, x, top + size * 0.2)
  ctx.closePath()
  ctx.fillStyle = tone.main
  ctx.strokeStyle = tone.dark
  ctx.lineWidth = size * 0.025
  ctx.fill()
  ctx.stroke()
}

// The capital's mark: a golden crown floating above the houses
export function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number): void {
  const w = size * 0.2 // half the crown's width
  const h = size * 0.24
  const top = y - h + Math.sin(time * 2) * size * 0.02
  ctx.beginPath()
  ctx.moveTo(x - w, top + h)
  ctx.lineTo(x - w * 1.1, top + h * 0.25)
  ctx.lineTo(x - w * 0.45, top + h * 0.6)
  ctx.lineTo(x, top)
  ctx.lineTo(x + w * 0.45, top + h * 0.6)
  ctx.lineTo(x + w * 1.1, top + h * 0.25)
  ctx.lineTo(x + w, top + h)
  ctx.closePath()
  ctx.fillStyle = GOLD.main
  ctx.strokeStyle = GOLD.dark
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.03
  ctx.fill()
  ctx.stroke()
  for (const [px, py] of [[-1.1, 0.25], [0, 0], [1.1, 0.25]]) {
    ctx.beginPath()
    ctx.arc(x + px * w, top + py * h, size * 0.035, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

// A small walker; `phase` drives the bobbing and the swinging legs; soldiers get a helmet and a spear
export function drawPerson(
  ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: Tone, phase: number, soldier = false,
): void {
  const h = size * 0.34
  const bob = Math.abs(Math.sin(phase)) * h * 0.1
  const swing = Math.sin(phase) * h * 0.12
  ellipse(ctx, x, y, h * 0.32, h * 0.1, SHADOW)

  ctx.strokeStyle = tone.dark
  ctx.lineCap = 'round'
  ctx.lineWidth = h * 0.13
  ctx.beginPath()
  ctx.moveTo(x - h * 0.1, y - h * 0.3 - bob)
  ctx.lineTo(x - h * 0.1 + swing, y - h * 0.04)
  ctx.moveTo(x + h * 0.1, y - h * 0.3 - bob)
  ctx.lineTo(x + h * 0.1 - swing, y - h * 0.04)
  ctx.stroke()

  ctx.lineWidth = h * 0.08
  ctx.lineJoin = 'round'
  ctx.fillStyle = tone.main
  ctx.beginPath()
  ctx.moveTo(x - h * 0.25, y - h * 0.24 - bob)
  ctx.lineTo(x - h * 0.17, y - h * 0.62 - bob)
  ctx.quadraticCurveTo(x, y - h * 0.78 - bob, x + h * 0.17, y - h * 0.62 - bob)
  ctx.lineTo(x + h * 0.25, y - h * 0.24 - bob)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y - h * 0.88 - bob, h * 0.19, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  if (soldier) {
    ctx.fillStyle = STEEL.main
    ctx.strokeStyle = STEEL.dark
    ctx.lineWidth = h * 0.07
    ctx.beginPath()
    ctx.arc(x, y - h * 0.9 - bob, h * 0.22, Math.PI, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // Spear: a shaft and a steel tip
    ctx.strokeStyle = WOOD.trunk
    ctx.lineWidth = h * 0.08
    ctx.beginPath()
    ctx.moveTo(x + h * 0.36, y - h * 0.1 - bob)
    ctx.lineTo(x + h * 0.36, y - h * 1.15 - bob)
    ctx.stroke()
    ctx.fillStyle = STEEL.main
    ctx.beginPath()
    ctx.moveTo(x + h * 0.27, y - h * 1.1 - bob)
    ctx.lineTo(x + h * 0.36, y - h * 1.38 - bob)
    ctx.lineTo(x + h * 0.45, y - h * 1.1 - bob)
    ctx.closePath()
    ctx.fill()
  }
  ctx.lineCap = 'butt'
}

// Buildings stand on their tile like game pieces; roofs and pennants show the owner
export function drawBuilding(
  ctx: CanvasRenderingContext2D, kind: BuildingKind, x: number, y: number, size: number, tone: Tone,
): void {
  if (kind === 'farm') drawFarm(ctx, x, y, size, tone)
  else drawTower(ctx, x, y, size, tone)
}

// Furrowed plot with ripe wheat and a haystack
function drawFarm(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: Tone): void {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(x - size * 0.08, y + size * 0.08, size * 0.5, size * 0.3, 0, 0, Math.PI * 2)
  ctx.fillStyle = FARM.soil
  ctx.fill()
  ctx.clip()
  ctx.strokeStyle = FARM.wheat
  ctx.lineWidth = size * 0.07
  ctx.lineCap = 'round'
  for (let row = -2; row <= 2; row++) {
    const rowY = y + size * (0.08 + row * 0.13)
    ctx.beginPath()
    ctx.moveTo(x - size * 0.6, rowY + size * 0.1)
    ctx.lineTo(x + size * 0.4, rowY - size * 0.1)
    ctx.stroke()
  }
  ctx.restore()

  const hx = x + size * 0.32
  const hy = y + size * 0.02
  ellipse(ctx, hx, hy + size * 0.02, size * 0.17, size * 0.06, SHADOW)
  ctx.beginPath()
  ctx.arc(hx, hy, size * 0.15, Math.PI, 0)
  ctx.closePath()
  ctx.fillStyle = FARM.hay
  ctx.strokeStyle = FARM.hayDark
  ctx.lineWidth = size * 0.03
  ctx.fill()
  ctx.stroke()
  drawPennant(ctx, hx, hy - size * 0.13, size * 0.7, tone)
}

// A wooden lookout on four legs
function drawTower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: Tone): void {
  const top = y - size * 0.55
  ellipse(ctx, x, y + size * 0.1, size * 0.3, size * 0.1, SHADOW)
  ctx.strokeStyle = WOOD.roof
  ctx.lineCap = 'round'
  ctx.lineWidth = size * 0.05
  ctx.beginPath()
  ctx.moveTo(x - size * 0.2, y + size * 0.1)
  ctx.lineTo(x - size * 0.13, top)
  ctx.moveTo(x + size * 0.2, y + size * 0.1)
  ctx.lineTo(x + size * 0.13, top)
  ctx.stroke()
  ctx.lineWidth = size * 0.03
  ctx.beginPath()
  ctx.moveTo(x - size * 0.18, y - size * 0.05)
  ctx.lineTo(x + size * 0.15, top + size * 0.15)
  ctx.moveTo(x + size * 0.18, y - size * 0.05)
  ctx.lineTo(x - size * 0.15, top + size * 0.15)
  ctx.stroke()

  ctx.fillStyle = WOOD.trunk
  ctx.strokeStyle = WOOD.roof
  ctx.fillRect(x - size * 0.2, top - size * 0.08, size * 0.4, size * 0.1)
  ctx.strokeRect(x - size * 0.2, top - size * 0.08, size * 0.4, size * 0.1)
  ctx.beginPath()
  ctx.moveTo(x - size * 0.26, top - size * 0.08)
  ctx.lineTo(x, top - size * 0.32)
  ctx.lineTo(x + size * 0.26, top - size * 0.08)
  ctx.closePath()
  ctx.fillStyle = tone.main
  ctx.strokeStyle = tone.dark
  ctx.lineJoin = 'round'
  ctx.fill()
  ctx.stroke()
  ctx.lineCap = 'butt'
}

// Where a tower's arrows fly from, above its tile center
export const TOWER_TOP = 0.6

function drawPennant(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: Tone): void {
  ctx.strokeStyle = WOOD.trunk
  ctx.lineWidth = size * 0.04
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y - size * 0.35)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y - size * 0.35)
  ctx.lineTo(x + size * 0.22, y - size * 0.29)
  ctx.lineTo(x, y - size * 0.22)
  ctx.closePath()
  ctx.fillStyle = tone.main
  ctx.strokeStyle = tone.dark
  ctx.lineWidth = size * 0.025
  ctx.fill()
  ctx.stroke()
}

// A tower's arrow on its way: a short dark stroke flying in an arc; t goes from 0 to 1
export function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, t: number, size: number): void {
  const at = (k: number) => ({
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * size * 0.4,
  })
  const head = at(t)
  const tail = at(Math.max(0, t - 0.25))
  ctx.strokeStyle = WOOD.roof
  ctx.lineWidth = size * 0.04
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(tail.x, tail.y)
  ctx.lineTo(head.x, head.y)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

// A rounded label with a number, like a counter on a board game piece
export function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, size: number, tone: Tone): void {
  const height = size * 0.34
  ctx.font = `700 ${Math.round(height * 0.78)}px system-ui, sans-serif`
  const width = Math.max(height * 1.3, ctx.measureText(text).width + height * 0.7)
  ctx.beginPath()
  ctx.roundRect(x - width / 2, y - height / 2, width, height, height / 2)
  ctx.fillStyle = tone.light
  ctx.strokeStyle = tone.dark
  ctx.lineWidth = size * 0.04
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = tone.dark
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + height * 0.04)
}
