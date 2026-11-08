import { hexDistance } from '../core/hex'
import type { GameMap } from './map'
import { SQUAD_SPEED, isPassable, moveCost } from './rules'
import type { Cell } from './world'

// A* search for the quickest way; other villages are in the way, only the goal can be one
export function findPath(map: GameMap, from: Cell, to: Cell): Cell[] | null {
  if (!isPassable(to)) return null
  const cost = new Map<Cell, number>([[from, 0]])
  const cameFrom = new Map<Cell, Cell>()
  const open = new Set<Cell>([from])
  // Estimated total cost through a cell: never more than the real one, as a step costs at least 1
  const estimate = (cell: Cell) => cost.get(cell)! + hexDistance(cell.hex, to.hex)

  while (open.size > 0) {
    let current = from
    let best = Infinity
    for (const cell of open) {
      if (estimate(cell) < best) {
        best = estimate(cell)
        current = cell
      }
    }
    if (current === to) return rebuildPath(cameFrom, to)
    open.delete(current)

    for (const next of map.neighbors(current)) {
      if (!isPassable(next) || (next.village && next !== to)) continue
      const nextCost = cost.get(current)! + moveCost(map.season, next.terrain)
      if (nextCost < (cost.get(next) ?? Infinity)) {
        cost.set(next, nextCost)
        cameFrom.set(next, current)
        open.add(next)
      }
    }
  }
  return null
}

// Seconds a squad needs to walk the path
export function pathDuration(map: GameMap, path: Cell[]): number {
  let cost = 0
  for (const cell of path.slice(1)) cost += moveCost(map.season, cell.terrain)
  return cost / SQUAD_SPEED
}

function rebuildPath(cameFrom: Map<Cell, Cell>, to: Cell): Cell[] {
  const path = [to]
  let cell = cameFrom.get(to)
  while (cell) {
    path.unshift(cell)
    cell = cameFrom.get(cell)
  }
  return path
}
