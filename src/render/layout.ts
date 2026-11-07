import { type Hex, type Point, SQRT3, hexToPoint, pointToHex } from '../core/hex'
import type { GameMap } from '../sim/map'

const MARGIN = 24
export const TILE_DEPTH = 0.16 // thickness of a tile, in tile sizes

// Where the board sits on screen and how big a tile is
export class Layout {
  size = 30
  private originX = 0
  private originY = 0

  fit(map: GameMap, width: number, height: number): void {
    const boardWidth = SQRT3 * map.width
    const boardHeight = 1.5 * (map.height - 1) + 2 + TILE_DEPTH
    // Not below a few pixels: the canvas can be tiny while the page is still being laid out
    this.size = Math.max(4, Math.min((width - 2 * MARGIN) / boardWidth, (height - 2 * MARGIN) / boardHeight))
    this.originX = (width - boardWidth * this.size) / 2 + (SQRT3 / 2) * this.size
    this.originY = (height - boardHeight * this.size) / 2 + this.size
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
}
