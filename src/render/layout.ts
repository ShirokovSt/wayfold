import { type Hex, type Point, SQRT3, hexToPoint, pointToHex } from '../core/hex'
import type { GameMap } from '../sim/map'

const MARGIN = 24
const MAX_ZOOM = 3
export const TILE_DEPTH = 0.16 // thickness of a tile, in tile sizes

export interface CameraView {
  zoom: number
  center: Point
}

// Where the board sits on screen and how big a tile is. At zoom 1 the whole map fits the screen;
// zooming in scales it around the screen center, and panning shifts it
export class Layout {
  zoom = 1
  touch = false
  private baseSize = 30
  private baseX = 0 // where hex (0, 0) is at zoom 1
  private baseY = 0
  private panX = 0
  private panY = 0
  private width = 0
  private height = 0
  private boardWidth = 0
  private boardHeight = 0

  get size(): number {
    return this.baseSize * this.zoom
  }

  fit(map: GameMap, width: number, height: number): void {
    const keepView = this.touch && this.zoom > 1 && this.width > 0 && this.height > 0
    const center = keepView ? this.fromScreen(this.width / 2, this.height / 2) : null
    const size = this.size
    const boardWidth = SQRT3 * map.width
    const boardHeight = 1.5 * (map.height - 1) + 2 + TILE_DEPTH
    // Not below a few pixels: the canvas can be tiny while the page is still being laid out
    this.baseSize = Math.max(4, Math.min((width - 2 * MARGIN) / boardWidth, (height - 2 * MARGIN) / boardHeight))
    this.baseX = (width - boardWidth * this.baseSize) / 2 + (SQRT3 / 2) * this.baseSize
    this.baseY = (height - boardHeight * this.baseSize) / 2 + this.baseSize
    this.width = width
    this.height = height
    this.boardWidth = boardWidth
    this.boardHeight = boardHeight
    if (center) {
      this.zoom = this.limitedZoom(size / this.baseSize)
      this.centerOn(center)
    } else {
      this.clampPan()
    }
  }

  resetCamera(): void {
    this.zoom = 1
    this.panX = 0
    this.panY = 0
  }

  cameraView(): CameraView {
    return { zoom: this.zoom, center: this.fromScreen(this.width / 2, this.height / 2) }
  }

  restoreCamera(view: CameraView): void {
    this.zoom = this.limitedZoom(view.zoom)
    this.centerOn(view.center)
  }

  frameCapital(hex: Hex): void {
    if (!this.touch || this.baseSize >= 19) return
    this.zoom = this.limitedZoom(19 / this.baseSize)
    this.centerOn(hexToPoint(hex, 1))
  }

  // Zooms so that the point under (x, y) stays where it is, like on online maps
  zoomAt(x: number, y: number, factor: number): void {
    const before = this.fromScreen(x, y)
    this.zoom = this.limitedZoom(this.zoom * factor)
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

  private centerOn(point: Point): void {
    const at = this.toScreen(point.x, point.y)
    this.panBy(this.width / 2 - at.x, this.height / 2 - at.y)
  }

  private limitedZoom(zoom: number): number {
    const max = this.touch ? Math.max(MAX_ZOOM, 32 / this.baseSize) : MAX_ZOOM
    return Math.min(max, Math.max(1, zoom))
  }

  // The zoomed board can be moved only as far as it sticks out beyond the screen
  private clampPan(): void {
    // A touch camera can center a settlement near the edge whenever it is zoomed in.
    const free = this.touch && this.zoom > 1
    const maxX = free ? this.boardWidth * this.size / 2 : this.width * (this.zoom - 1) / 2
    const maxY = free ? this.boardHeight * this.size / 2 : this.height * (this.zoom - 1) / 2
    this.panX = Math.min(maxX, Math.max(-maxX, this.panX))
    this.panY = Math.min(maxY, Math.max(-maxY, this.panY))
  }
}
