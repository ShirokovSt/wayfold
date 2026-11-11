import { DIFFICULTIES, type Difficulty, Rival } from './ai/rival'
import { createRandom } from './core/rng'
import { DEFAULT_SETTINGS, type MapSettings, createWorld } from './sim/mapgen'
import { Recording } from './sim/replay'
import { tick } from './sim/tick'
import { BEASTS, type Beasts, MAP_SIZES, MAP_TYPES, RIVAL, SEASONS, type Season, type World } from './sim/world'
import { readStored, store } from './storage'
import { tutorialWorld } from './tutorial/tutorial'

const SETTINGS_KEY = 'wayfold.map'

// What the new map card chooses: the map and how strong the rival is
export interface MatchSettings extends MapSettings {
  season: Season | 'random'
  beasts: Beasts
  difficulty: Difficulty
}

// One match: the world plus the AI that plays against you, and the settings for the next one
export class Game {
  world!: World
  settings: MatchSettings = loadSettings()
  paused = true
  started = false // false until a match is started from the menu
  speed = 1 // how many game seconds pass in a real second
  watching = false // the finished match is played again: no orders, the moves come from the recording
  private rival: Rival | null = null // none in the tutorial: the rival there only waits
  private recording!: Recording

  constructor(seed: number) {
    this.restart(seed)
  }

  restart(seed: number): void {
    this.begin(createWorld(seed, this.settings))
    this.rival = new Rival(RIVAL, createRandom(seed + 1), this.settings.difficulty)
  }

  startTutorial(): void {
    this.begin(tutorialWorld())
    this.rival = null
  }

  private begin(world: World): void {
    this.world = world
    this.recording = new Recording(world)
    this.started = false
    this.watching = false
  }

  get replayLength(): number {
    return this.recording.length
  }

  // Watching starts from the beginning; jumping to a moment rebuilds the world as it was then
  watch(ticks = 0): void {
    this.watching = true
    this.world = this.recording.at(ticks)
  }

  stopWatching(): void {
    this.watching = false
    this.world = this.recording.live
  }

  changeSettings(settings: MatchSettings): void {
    this.settings = settings
    store(SETTINGS_KEY, JSON.stringify(settings))
  }

  update(dt: number): void {
    if (this.paused || this.world.winner !== null) return
    if (this.watching) {
      this.recording.step(this.world)
      return
    }
    this.rival?.update(this.world, dt)
    tick(this.world, dt)
    this.recording.update()
  }
}

// A saved value that is missing or no longer valid falls back to the default
function loadSettings(): MatchSettings {
  let saved: Partial<MatchSettings> = {}
  try {
    saved = JSON.parse(readStored(SETTINGS_KEY) ?? '{}')
  } catch {
    // Not JSON: use the defaults
  }
  return {
    size: saved.size && MAP_SIZES.includes(saved.size) ? saved.size : DEFAULT_SETTINGS.size,
    type: saved.type === 'random' || (saved.type && MAP_TYPES.includes(saved.type)) ? saved.type : DEFAULT_SETTINGS.type,
    season: saved.season === 'random' || (saved.season && SEASONS.includes(saved.season)) ? saved.season : 'random',
    beasts: saved.beasts && BEASTS.includes(saved.beasts) ? saved.beasts : 'few',
    difficulty: saved.difficulty && DIFFICULTIES.includes(saved.difficulty) ? saved.difficulty : 'normal',
  }
}
