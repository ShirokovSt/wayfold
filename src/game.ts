import { DIFFICULTIES, type Difficulty, Rival } from './ai/rival'
import { createRandom } from './core/rng'
import { DEFAULT_SETTINGS, type MapSettings, createWorld } from './sim/mapgen'
import { tick } from './sim/tick'
import { MAP_SIZES, MAP_TYPES, RIVAL, type World } from './sim/world'

const SETTINGS_KEY = 'wayfold.map'

// What the new map card chooses: the map and how strong the rival is
export interface MatchSettings extends MapSettings {
  difficulty: Difficulty
}

// One match: the world plus the AI that plays against you, and the settings for the next one
export class Game {
  world!: World
  settings: MatchSettings = loadSettings()
  paused = true
  started = false // false until a match is started from the menu
  speed = 1 // how many game seconds pass in a real second
  private rival!: Rival

  constructor(seed: number) {
    this.restart(seed)
  }

  restart(seed: number): void {
    this.world = createWorld(seed, this.settings)
    this.started = false
    this.rival = new Rival(RIVAL, createRandom(seed + 1), this.settings.difficulty)
  }

  changeSettings(settings: MatchSettings): void {
    this.settings = settings
    saveSettings(settings)
  }

  update(dt: number): void {
    if (this.paused || this.world.winner !== null) return
    this.rival.update(this.world, dt)
    tick(this.world, dt)
  }
}

// The choice is remembered in the browser; storage can be unavailable, e.g. in private mode
function loadSettings(): MatchSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    return {
      size: MAP_SIZES.includes(saved.size) ? saved.size : DEFAULT_SETTINGS.size,
      type: saved.type === 'random' || MAP_TYPES.includes(saved.type) ? saved.type : DEFAULT_SETTINGS.type,
      difficulty: DIFFICULTIES.includes(saved.difficulty) ? saved.difficulty : 'normal',
    }
  } catch {
    return { ...DEFAULT_SETTINGS, difficulty: 'normal' }
  }
}

function saveSettings(settings: MatchSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Not saved: the game still works, the choice is just forgotten on reload
  }
}
