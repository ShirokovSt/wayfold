// Axial hex coordinates for "pointy-top" hexagons, see redblobgames.com/grids/hexagons
export interface Hex {
  readonly q: number
  readonly r: number
}

export interface Point {
  x: number
  y: number
}

export const SQRT3 = Math.sqrt(3)

// Neighbor i lies across edge i, the edge between corners i and i + 1
export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 }, // east
  { q: 0, r: 1 }, // south-east
  { q: -1, r: 1 }, // south-west
  { q: -1, r: 0 }, // west
  { q: 0, r: -1 }, // north-west
  { q: 1, r: -1 }, // north-east
]

export function addHex(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r }
}

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

// Center of the hex, for hexes with the given outer radius
export function hexToPoint(hex: Hex, size: number): Point {
  return { x: size * SQRT3 * (hex.q + hex.r / 2), y: size * 1.5 * hex.r }
}

export function pointToHex(point: Point, size: number): Hex {
  const q = ((SQRT3 / 3) * point.x - point.y / 3) / size
  const r = ((2 / 3) * point.y) / size
  return roundHex(q, r)
}

// Corner 0 is at the upper right, the rest follow clockwise
export function hexCorner(center: Point, size: number, i: number): Point {
  const angle = (Math.PI / 180) * (60 * i - 30)
  return { x: center.x + size * Math.cos(angle), y: center.y + size * Math.sin(angle) }
}

// The hexes on a straight line from a to b, both included
export function hexLine(a: Hex, b: Hex): Hex[] {
  const steps = hexDistance(a, b)
  const line: Hex[] = []
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps
    // A tiny nudge keeps the line from running exactly along hex edges
    line.push(roundHex(a.q + (b.q - a.q) * t + 1e-6, a.r + (b.r - a.r) * t + 1e-6))
  }
  return line
}

// Rounds fractional coordinates to the hex that contains them
function roundHex(q: number, r: number): Hex {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return { q: rq, r: rr }
}
