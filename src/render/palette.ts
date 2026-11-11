import type { Owner, Season, Terrain } from '../sim/world'

export interface Tone {
  main: string
  dark: string
  light: string
}

const PLAYER_TONES: Tone[] = [
  { main: '#8a4fc8', dark: '#4e2a80', light: '#e4d4f6' }, // you: violet stands out against water, fields and the red rival
  { main: '#d6493c', dark: '#8a261d', light: '#f6d2cc' }, // rival
]
const NEUTRAL_TONE: Tone = { main: '#d8ccb2', dark: '#7d715b', light: '#f4eedf' }

export function ownerTone(owner: Owner): Tone {
  return owner === null ? NEUTRAL_TONE : PLAYER_TONES[owner]
}

type TileColors = Record<Terrain, { top: string; side: string }>
const WATER = { top: '#5d9cc6', side: '#3e6f90' }
const ICE = { top: '#b9dbea', side: '#7fa6b8' } // bluer than snow, so frozen rivers stand out
const SUMMER: TileColors = {
  field: { top: '#c3d27a', side: '#8b8a4b' },
  forest: { top: '#88a65a', side: '#5f7039' },
  mountain: { top: '#b3a691', side: '#776b59' },
  water: WATER,
  ford: WATER, // water, with a sandbar drawn across
  ice: ICE,
}

// Top face and the darker side of each tile, by season
export const TERRAIN: Record<Season, TileColors> = {
  summer: SUMMER,
  autumn: { ...SUMMER, field: { top: '#d4c27c', side: '#8f7e48' }, forest: { top: '#b39554', side: '#73603a' } },
  winter: { ...SUMMER, field: { top: '#eef2f2', side: '#a7b2b5' }, forest: { top: '#e2eaeb', side: '#9aa7ab' }, ford: ICE },
  spring: { ...SUMMER, field: { top: '#d2eb94', side: '#93ab5c' }, forest: { top: '#a3c96f', side: '#6a8841' } },
}

// Tree crowns and their outline by season: green, then orange, then under snow, then in blossom
export const LEAVES: Record<Season, { crowns: string[]; edge: string }> = {
  summer: { crowns: ['#4f7f3a', '#5c8d3f', '#467334'], edge: '#2f4a22' },
  autumn: { crowns: ['#d9822b', '#c9562c', '#e0a83a'], edge: '#6b3f1d' },
  winter: { crowns: ['#e9eff0', '#dfe7e9', '#f4f7f7'], edge: '#8c999d' },
  spring: { crowns: ['#f4b6c8', '#fbe6ee', '#9fd36a'], edge: '#7a6a5a' },
}
export const GRASS: Record<Season, string> = {
  summer: 'rgba(90, 110, 40, 0.45)',
  autumn: 'rgba(125, 90, 40, 0.45)',
  winter: 'rgba(140, 155, 160, 0.5)',
  spring: 'rgba(70, 125, 40, 0.45)',
}
export const FLOWERS = ['#f4f0ff', '#f7b6d2', '#ffe680', '#c9b3f2']
export const PUDDLE = { water: '#a9d4ea', shine: 'rgba(255, 255, 255, 0.6)' }
export const SNOW = '#f7fafa'

export const TABLE = { center: '#6b4a32', edge: '#3a271a', grain: 'rgba(255, 230, 200, 0.05)' }
export const WOOD = { trunk: '#7a5134', roof: '#5a3b26', wall: '#f1e4c6', door: '#5a3b26' }
export const ROCK = { light: '#cfc4b0', dark: '#8a7e6a', snow: '#f7f5ee' }
export const GOLD = { main: '#f2c14e', dark: '#8a6514' }
export const STEEL = { main: '#b8c0c8', dark: '#5d666f' }
export const STONE = { main: '#b4aca0', dark: '#6e665b' }
export const FARM = { soil: '#9a6b43', wheat: '#e3c25a', hay: '#e8c35c', hayDark: '#9c7a2a' }
export const SANDBAR = { sand: '#dcc58e', edge: '#b39b62', pebble: '#9c8f74' }
export const SHADOW = 'rgba(40, 25, 10, 0.25)'
// Wolves and their dens: grey fur, and the wild land around a den in a dark shade
export const WOLF = { fur: '#8f8a82', dark: '#45413c', belly: '#cfc8bb', eye: '#f2c14e' }
export const WILD_TONE: Tone = { main: '#8f8a82', dark: '#45413c', light: '#ebe6dc' }
export const WILD_LAND = 'rgba(40, 45, 25, 0.22)'
export const CLAW = '#f4eedf'
// Hint cards drawn on the board, like the paper cards of the top bar
export const HINT = { card: '#f5ecd9', ink: '#3b2a1d', shadow: 'rgba(0, 0, 0, 0.35)' }
