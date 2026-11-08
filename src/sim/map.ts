import { DIRECTIONS, type Hex, addHex, hexDistance } from '../core/hex'
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
        this.cells.push({ hex, index: this.cells.length, terrain: 'field', owner: null, village: null, building: null })
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

  // Cells at most `radius` steps away, including the cell itself
  within(cell: Cell, radius: number): Cell[] {
    return this.cells.filter((other) => hexDistance(cell.hex, other.hex) <= radius)
  }

  // The cell this one lands on after a 180° turn: in row-by-row order that is just the reverse
  mirror(cell: Cell): Cell {
    return this.cells[this.cells.length - 1 - cell.index]
  }
}
