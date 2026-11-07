import type { Owner, Terrain } from '../sim/world'

export interface Tone {
  main: string
  dark: string
  light: string
}

const PLAYER_TONES: Tone[] = [
  { main: '#3f7fd6', dark: '#1f4c8c', light: '#cfe0f7' }, // you
  { main: '#d6493c', dark: '#8a261d', light: '#f6d2cc' }, // rival
]
const NEUTRAL_TONE: Tone = { main: '#d8ccb2', dark: '#7d715b', light: '#f4eedf' }

export function ownerTone(owner: Owner): Tone {
  return owner === null ? NEUTRAL_TONE : PLAYER_TONES[owner]
}

// Top face and the darker side of each tile
export const TERRAIN: Record<Terrain, { top: string; side: string }> = {
  field: { top: '#c3d27a', side: '#8b8a4b' },
  forest: { top: '#88a65a', side: '#5f7039' },
  mountain: { top: '#b3a691', side: '#776b59' },
  water: { top: '#5d9cc6', side: '#3e6f90' },
  ford: { top: '#86bcd6', side: '#5b88a1' },
}

export const TABLE = { center: '#6b4a32', edge: '#3a271a', grain: 'rgba(255, 230, 200, 0.05)' }
export const WOOD = { trunk: '#7a5134', roof: '#5a3b26', wall: '#f1e4c6', door: '#5a3b26' }
export const LEAVES = ['#4f7f3a', '#5c8d3f', '#467334']
export const ROCK = { light: '#cfc4b0', dark: '#8a7e6a', snow: '#f7f5ee' }
export const SHADOW = 'rgba(40, 25, 10, 0.25)'
