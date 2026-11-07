import { type Hex, type Point, SQRT3, hexToPoint, pointToHex } from '../core/hex'
import type { GameMap } from '../sim/map'

const MARGIN = 24
const MAX_ZOOM = 3
export const TILE_DEPTH = 0.16 // thickness of a tile, in tile sizes

// Where the board sits on screen and how big a tile is. At zoom 1 the whole map fits the screen;
// zooming in scales it around the screen center, and panning shifts it
export class Layout {
  zoom = 1
  private baseSize = 30
  private baseX = 0 // where hex (0, 0) is at zoom 1
  private baseY = 0
  private panX = 0
  private panY = 0
  private width = 0
  private height = 0

  get size(): number {
    return this.baseSize * this.zoom
  }

  fit(map: GameMap, width: number, height: number): void {
    const boardWidth = SQRT3 * map.width
    const boardHeight = 1.5 * (map.height - 1) + 2 + TILE_DEPTH
    // Not below a few pixels: the canvas can be tiny while the page is still being laid out
    this.baseSize = Math.max(4, Math.min((width - 2 * MARGIN) / boardWidth, (height - 2 * MARGIN) / boardHeight))
    this.baseX = (width - boardWidth * this.baseSize) / 2 + (SQRT3 / 2) * this.baseSize
    this.baseY = (height - boardHeight * this.baseSize) / 2 + this.baseSize
    this.width = width
    this.height = height
    this.clampPan()
  }

  resetCamera(): void {
    this.zoom = 1
    this.panX = 0
    this.panY = 0
  }

  // Zooms so that the point under (x, y) stays where it is, like on online maps
  zoomAt(x: number, y: number, factor: number): void {
    const before = this.fromScreen(x, y)
    this.zoom = Math.min(MAX_ZOOM, Math.max(1, this.zoom * factor))
    const after = this.toScreen(before.x, before.y)
    this.panX += x - after.x
    this.panY += y - after.y
    this.clampPan()
  }

  panBy(dx: number, dy: number): void {
    this.panX += dx
    this.panY += dy
    this.clampPan()
  }

  // From hex radii (as squads store their position) to screen pixels
  toScreen(x: number, y: number): Point {
    return { x: this.originX + x * this.size, y: this.originY + y * this.size }
  }

  hexToScreen(hex: Hex): Point {
    const point = hexToPoint(hex, 1)
    return this.toScreen(point.x, point.y)
  }

  // Back from screen pixels to hex radii
  fromScreen(x: number, y: number): Point {
    return { x: (x - this.originX) / this.size, y: (y - this.originY) / this.size }
  }

  screenToHex(x: number, y: number): Hex {
    return pointToHex(this.fromScreen(x, y), 1)
  }

  private get originX(): number {
    return this.width / 2 + (this.baseX - this.width / 2) * this.zoom + this.panX
  }

  private get originY(): number {
    return this.height / 2 + (this.baseY - this.height / 2) * this.zoom + this.panY
  }

  // The zoomed board can be moved only as far as it sticks out beyond the screen
  private clampPan(): void {
    const maxX = (this.width * (this.zoom - 1)) / 2
    const maxY = (this.height * (this.zoom - 1)) / 2
    this.panX = Math.min(maxX, Math.max(-maxX, this.panX))
    this.panY = Math.min(maxY, Math.max(-maxY, this.panY))
  }
}
