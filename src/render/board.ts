import { DIRECTIONS, type Point, addHex, hexCorner } from '../core/hex'
import { type Random, createRandom } from '../core/rng'
import type { GameMap } from '../sim/map'
import { estateTiles, estateVillage } from '../sim/estates'
import type { Cell, Village, World } from '../sim/world'
import { type Layout, TILE_DEPTH } from './layout'
import { LEAVES, ROCK, SHADOW, TABLE, TERRAIN, WOOD, ownerTone } from './palette'

const FACE = 0.93 // top face radius in tile sizes, the rest is the gap between tiles
const BORDER = 0.8 // where the border line runs, inside the tile

// Water tiles lie lower than the land, like cut-outs in the board
export function tileCenter(layout: Layout, cell: Cell): Point {
  const point = layout.hexToScreen(cell.hex)
  if (isWater(cell)) point.y += layout.size * TILE_DEPTH * 0.6
  return point
}

export function hexPath(ctx: CanvasRenderingContext2D, center: Point, radius: number): void {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const corner = hexCorner(center, radius, i)
    ctx.lineTo(corner.x, corner.y)
  }
  ctx.closePath()
}

export function drawTable(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7)
  gradient.addColorStop(0, TABLE.center)
  gradient.addColorStop(1, TABLE.edge)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Wood grain: long, slightly wavy lines
  const random = createRandom(7)
  ctx.strokeStyle = TABLE.grain
  ctx.lineWidth = 2
  for (let y = 0; y < height; y += 9 + random() * 14) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= width; x += 80) ctx.lineTo(x, y + Math.sin(x / 140 + y) * 4)
    ctx.stroke()
  }
}

// Tiles go row by row, so each row covers the sides of the row above
export function drawGround(ctx: CanvasRenderingContext2D, map: GameMap, layout: Layout): void {
  const size = layout.size
  const rounding = size * 0.08 // a thick stroke in the same color rounds the corners
  ctx.lineJoin = 'round'
  ctx.lineWidth = rounding
  for (const cell of map.cells) {
    const center = tileCenter(layout, cell)
    const colors = TERRAIN[cell.terrain]
    const radius = size * FACE - rounding / 2

    if (!isWater(cell)) {
      hexPath(ctx, { x: center.x, y: center.y + size * TILE_DEPTH }, radius)
      ctx.fillStyle = ctx.strokeStyle = colors.side
      ctx.fill()
      ctx.stroke()
    }
    const light = ctx.createLinearGradient(0, center.y - size, 0, center.y + size)
    light.addColorStop(0, shade(colors.top, 0.12))
    light.addColorStop(1, colors.top)
    hexPath(ctx, center, radius)
    ctx.fillStyle = ctx.strokeStyle = light
    ctx.fill()
    ctx.stroke()

    drawTexture(ctx, cell, center, size, createRandom(cell.index * 9973 + 17))
  }
}

// Player colors over the tiles, and a thick line along the edge of each territory
export function drawTerritory(ctx: CanvasRenderingContext2D, map: GameMap, layout: Layout): void {
  const size = layout.size
  ctx.globalAlpha = 0.5
  for (const cell of map.cells) {
    if (cell.owner === null) continue
    hexPath(ctx, tileCenter(layout, cell), size * FACE * 0.97)
    ctx.fillStyle = ownerTone(cell.owner).main
    ctx.fill()
  }
  ctx.globalAlpha = 1

  ctx.lineWidth = size * 0.09
  ctx.lineCap = 'round'
  for (const cell of map.cells) {
    if (cell.owner === null) continue
    const center = tileCenter(layout, cell)
    ctx.strokeStyle = ownerTone(cell.owner).dark
    ctx.beginPath()
    DIRECTIONS.forEach((direction, i) => {
      if (map.cellAt(addHex(cell.hex, direction))?.owner === cell.owner) return
      const a = hexCorner(center, size * BORDER, i)
      const b = hexCorner(center, size * BORDER, i + 1)
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
    })
    ctx.stroke()
  }
}

// Trees and mountains, drawn above the territory colors
export function drawDecor(ctx: CanvasRenderingContext2D, map: GameMap, layout: Layout): void {
  const size = layout.size
  for (const cell of map.cells) {
    const center = tileCenter(layout, cell)
    const random = createRandom(cell.index * 7919 + 3)
    if (cell.terrain === 'forest') {
      const spots = [
        { x: -0.32, y: -0.12 },
        { x: 0.3, y: -0.18 },
        { x: -0.02, y: 0.3 },
        { x: 0.04, y: -0.42 },
      ]
      for (const spot of spots.slice(0, 3 + Math.floor(random() * 2)).sort((a, b) => a.y - b.y)) {
        const x = center.x + (spot.x + (random() - 0.5) * 0.12) * size
        const y = center.y + (spot.y + (random() - 0.5) * 0.12) * size + size * 0.2
        if (random() < 0.4) drawPine(ctx, x, y, size, random)
        else drawTree(ctx, x, y, size, random)
      }
    } else if (cell.terrain === 'mountain') {
      drawMountain(ctx, center.x, center.y, size)
    }
  }
}

function drawTexture(ctx: CanvasRenderingContext2D, cell: Cell, center: Point, size: number, random: Random): void {
  const at = () => ({ x: center.x + (random() - 0.5) * size * 1.1, y: center.y + (random() - 0.5) * size * 0.9 })
  ctx.lineCap = 'round'
  if (cell.terrain === 'field') {
    // Little tufts of grass
    ctx.strokeStyle = 'rgba(90, 110, 40, 0.45)'
    ctx.lineWidth = size * 0.035
    for (let i = 0; i < 5; i++) {
      const { x, y } = at()
      ctx.beginPath()
      ctx.moveTo(x - size * 0.05, y - size * 0.07)
      ctx.lineTo(x, y)
      ctx.lineTo(x + size * 0.05, y - size * 0.07)
      ctx.stroke()
    }
  } else if (isWater(cell)) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = size * 0.04
    for (let i = 0; i < 2; i++) {
      const { x, y } = at()
      ctx.beginPath()
      ctx.moveTo(x - size * 0.18, y)
      ctx.quadraticCurveTo(x - size * 0.09, y - size * 0.07, x, y)
      ctx.quadraticCurveTo(x + size * 0.09, y + size * 0.07, x + size * 0.18, y)
      ctx.stroke()
    }
    if (cell.terrain === 'ford') {
      // Stepping stones
      for (let i = -1; i <= 1; i++) {
        ellipse(ctx, center.x + i * size * 0.32, center.y + i * size * 0.1, size * 0.12, size * 0.08, ROCK.light)
      }
    }
  }
  ctx.lineCap = 'butt'
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, random: Random): void {
  const crown = size * (0.17 + random() * 0.05)
  ellipse(ctx, x + size * 0.04, y, crown * 1.1, crown * 0.4, SHADOW)
  ctx.fillStyle = WOOD.trunk
  ctx.fillRect(x - size * 0.035, y - size * 0.2, size * 0.07, size * 0.2)
  ctx.beginPath()
  ctx.arc(x, y - size * 0.2 - crown * 0.8, crown, 0, Math.PI * 2)
  ctx.fillStyle = LEAVES[Math.floor(random() * LEAVES.length)]
  ctx.fill()
  ctx.strokeStyle = '#2f4a22'
  ctx.lineWidth = size * 0.025
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x - crown * 0.35, y - size * 0.2 - crown * 1.15, crown * 0.38, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.fill()
}

function drawPine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, random: Random): void {
  const width = size * (0.2 + random() * 0.05)
  ellipse(ctx, x + size * 0.04, y, width * 1.1, width * 0.4, SHADOW)
  ctx.fillStyle = WOOD.trunk
  ctx.fillRect(x - size * 0.03, y - size * 0.12, size * 0.06, size * 0.12)
  ctx.fillStyle = '#3f6b35'
  ctx.strokeStyle = '#263f20'
  ctx.lineWidth = size * 0.025
  ctx.lineJoin = 'round'
  // Two layers of branches, the upper one smaller
  for (const [bottom, half, height] of [[0.1, 1, 0.38], [0.32, 0.75, 0.34]]) {
    ctx.beginPath()
    ctx.moveTo(x - width * half, y - size * bottom)
    ctx.lineTo(x, y - size * (bottom + height))
    ctx.lineTo(x + width * half, y - size * bottom)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

function drawMountain(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ellipse(ctx, x, y + size * 0.3, size * 0.6, size * 0.16, SHADOW)
  peak(ctx, x - size * 0.6, x + size * 0.35, y + size * 0.32, x - size * 0.12, y - size * 0.55, size)
  peak(ctx, x - size * 0.05, x + size * 0.62, y + size * 0.36, x + size * 0.3, y - size * 0.15, size)

  // Snow on the high peak
  ctx.beginPath()
  ctx.moveTo(x - size * 0.12, y - size * 0.55)
  ctx.lineTo(x - size * 0.27, y - size * 0.3)
  ctx.lineTo(x - size * 0.17, y - size * 0.34)
  ctx.lineTo(x - size * 0.1, y - size * 0.27)
  ctx.lineTo(x - size * 0.02, y - size * 0.35)
  ctx.lineTo(x + size * 0.04, y - size * 0.31)
  ctx.closePath()
  ctx.fillStyle = ROCK.snow
  ctx.fill()
}

// A triangle lit from the left: the left slope light, the right one dark
function peak(ctx: CanvasRenderingContext2D, left: number, right: number, base: number, topX: number, topY: number, size: number): void {
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.03
  ctx.strokeStyle = '#5f5546'
  ctx.beginPath()
  ctx.moveTo(left, base)
  ctx.lineTo(topX, topY)
  ctx.lineTo(right, base)
  ctx.closePath()
  ctx.fillStyle = ROCK.dark
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(left, base)
  ctx.lineTo(topX, topY)
  ctx.lineTo(topX + (right - topX) * 0.15, base)
  ctx.closePath()
  ctx.fillStyle = ROCK.light
  ctx.fill()
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

function isWater(cell: Cell): boolean {
  return cell.terrain === 'water' || cell.terrain === 'ford'
}

// Mixes a #rrggbb color with white (amount > 0) or black (amount < 0)
function shade(color: string, amount: number): string {
  const target = amount > 0 ? 255 : 0
  const channels = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  const mixed = channels.map((c) => Math.round(c + (target - c) * Math.abs(amount)))
  return `rgb(${mixed.join(', ')})`
}

// Thin dashed lines between the estates of one player's villages; the hovered village's estate is lit up
export function drawEstates(ctx: CanvasRenderingContext2D, world: World, layout: Layout, lit: Village | null): void {
  const size = layout.size
  const estates = new Map<Cell, Village | null>()
  for (const cell of world.map.cells) estates.set(cell, estateVillage(world, cell))

  if (lit) {
    ctx.globalAlpha = 0.35
    ctx.fillStyle = ownerTone(lit.owner).light
    for (const cell of estateTiles(world, lit)) {
      hexPath(ctx, tileCenter(layout, cell), size * FACE * 0.97)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  ctx.setLineDash([size * 0.2, size * 0.14])
  ctx.lineCap = 'round'
  ctx.lineWidth = size * 0.075
  for (const cell of world.map.cells) {
    const estate = estates.get(cell)
    if (!estate) continue
    const center = tileCenter(layout, cell)
    ctx.strokeStyle = ownerTone(cell.owner).light
    ctx.beginPath()
    DIRECTIONS.forEach((direction, i) => {
      const neighbor = world.map.cellAt(addHex(cell.hex, direction))
      // Each shared edge once: only from the cell with the smaller index
      if (!neighbor || neighbor.index < cell.index || neighbor.owner !== cell.owner) return
      const other = estates.get(neighbor)
      if (!other || other === estate) return
      const a = hexCorner(center, size * FACE, i)
      const b = hexCorner(center, size * FACE, i + 1)
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
    })
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.lineCap = 'butt'
}
