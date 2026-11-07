import { ellipse } from './board'
import { SHADOW, type Tone, WOOD } from './palette'

// Village pieces: three little houses with roofs in the owner's color and a flag
export function drawVillage(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: Tone, time: number): void {
  ellipse(ctx, x, y + size * 0.1, size * 0.44, size * 0.17, SHADOW)
  drawFlag(ctx, x + size * 0.4, y - size * 0.02, size, tone, time)
  drawHouse(ctx, x - size * 0.25, y - size * 0.1, size * 0.33, tone)
  drawHouse(ctx, x + size * 0.17, y - size * 0.17, size * 0.3, tone)
  drawHouse(ctx, x - size * 0.02, y + size * 0.18, size * 0.4, tone)
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

// A small walker; `phase` drives the bobbing and the swinging legs
export function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: Tone, phase: number): void {
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
