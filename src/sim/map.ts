import { DIRECTIONS, type Hex, addHex } from '../core/hex'
import type { Cell, Season } from './world'

// A rectangle of hexes; odd rows are one tile shorter and shifted half a tile right,
// so the map looks the same after a 180° turn (both players get a fair start)
export class GameMap {
  readonly cells: Cell[] = []
  season: Season = 'summer'
  private readonly rowStarts: number[] = []

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    for (let row = 0; row < height; row++) {
      this.rowStarts.push(this.cells.length)
      for (let col = 0; col < this.rowLength(row); col++) {
        const hex = { q: col - Math.floor(row / 2), r: row }
        this.cells.push({
          hex, index: this.cells.length, terrain: 'field', owner: null, village: null, building: null, lair: null, wild: false,
        })
      }
    }
  }

  rowLength(row: number): number {
    return row % 2 === 0 ? this.width : this.width - 1
  }

  // "Offset" coordinates: column and row, as the map is laid out on screen
  cellAtOffset(col: number, row: number): Cell | undefined {
    if (row < 0 || row >= this.height || col < 0 || col >= this.rowLength(row)) return undefined
    return this.cells[this.rowStarts[row] + col]
  }

  cellAt(hex: Hex): Cell | undefined {
    return this.cellAtOffset(hex.q + Math.floor(hex.r / 2), hex.r)
  }

  neighbors(cell: Cell): Cell[] {
    const result: Cell[] = []
    for (const direction of DIRECTIONS) {
      const next = this.cellAt(addHex(cell.hex, direction))
      if (next) result.push(next)
    }
    return result
  }

  // Cells at most `radius` steps away, in the map's row order.
  within(cell: Cell, radius: number): Cell[] {
    const { q, r } = cell.hex
    const firstRow = Math.max(0, Math.ceil(r - radius))
    const lastRow = Math.min(this.height - 1, Math.floor(r + radius))
    const result: Cell[] = []
    for (let row = firstRow; row <= lastRow; row++) {
      // Axial distance limits both the q offset and the sum of the q and r offsets.
      const dr = row - r
      const firstQ = q + Math.max(-radius, -radius - dr)
      const lastQ = q + Math.min(radius, radius - dr)
      const shift = Math.floor(row / 2)
      const firstCol = Math.max(0, Math.ceil(firstQ + shift))
      const lastCol = Math.min(this.rowLength(row) - 1, Math.floor(lastQ + shift))
      for (let col = firstCol; col <= lastCol; col++) {
        result.push(this.cells[this.rowStarts[row] + col])
      }
    }
    return result
  }

  // The cell this one lands on after a 180° turn: in row-by-row order that is just the reverse
  mirror(cell: Cell): Cell {
    return this.cells[this.cells.length - 1 - cell.index]
  }

  // Left and right swapped: odd rows are one tile shorter, so each row is centered and flips onto itself
  flipSides(cell: Cell): Cell {
    const row = cell.hex.r
    return this.cellAtOffset(this.rowLength(row) - 1 - this.column(cell), row)!
  }

  // Top and bottom swapped: the height is odd, so the rows keep their length
  flipEnds(cell: Cell): Cell {
    return this.cellAtOffset(this.column(cell), this.height - 1 - cell.hex.r)!
  }

  private column(cell: Cell): number {
    return cell.hex.q + Math.floor(cell.hex.r / 2)
  }
}
