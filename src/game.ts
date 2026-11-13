import { DIFFICULTIES, type Difficulty, Rival } from './ai/rival'
import { createRandom } from './core/rng'
import { DEFAULT_SETTINGS, type MapSettings, createWorld } from './sim/mapgen'
import { MAX_RIVALS } from './sim/rules'
import { type Replay, newReplay } from './replays/format'
import { Recording } from './sim/replay'
import { decodeStart, encodeStart, fingerprint } from './sim/snapshot'
import { standings, tick } from './sim/tick'
import { BEASTS, type Beasts, HUMAN, MAP_SIZES, MAP_TYPES, SEASONS, type Season, type World } from './sim/world'
import { readStored, store } from './storage'
import { tutorialWorld } from './tutorial/tutorial'

const SETTINGS_KEY = 'wayfold.map'

// What the new map card chooses: the map and how strong the rival is
export interface MatchSettings extends MapSettings {
  season: Season | 'random'
  beasts: Beasts
  rivals: number // 1 to 3, as many as the map size allows
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
  opened: Replay | null = null // a saved replay being watched, with no match of its own behind it
  private rivals: Rival[] = [] // none in the tutorial: the rival there only waits
  private recording!: Recording
  private live!: World
  private match: MatchSettings | null = null // what the match was started with; none for the tutorial

  constructor(seed: number) {
    this.restart(seed)
  }

  restart(seed: number): void {
    const settings = this.settings
    this.begin(createWorld(seed, { ...settings, players: settings.rivals + 1 }))
    this.match = settings
    this.rivals = this.world.players.slice(1).map((player, i) => new Rival(player, createRandom(seed + 1 + i * 7), settings.difficulty))
  }

  startTutorial(): void {
    this.begin(tutorialWorld())
  }

  // A saved replay, watched from the start
  open(replay: Replay): void {
    const start = decodeStart(replay.start)
    this.begin(start)
    this.recording = new Recording(start, replay.orders, () => replay.info.ticks)
    this.opened = replay
    this.started = true
    this.watch()
  }

  // Leaves a saved replay; the board keeps its last moment, behind the menu
  close(): void {
    this.watching = false
    this.started = false
    this.paused = true
  }

  private begin(world: World): void {
    this.world = world
    this.live = world
    this.recording = Recording.of(world)
    this.started = false
    this.watching = false
    this.opened = null
    this.match = null
    this.rivals = []
  }

  // The finished match, to be kept and watched again later; none for the tutorial
  replay(): Replay | null {
    const live = this.live
    if (!this.match || live.winner === null) return null
    const info = {
      savedAt: Date.now(), ticks: live.ticks, mapType: live.mapType, size: this.match.size, season: live.map.season,
      players: live.players.length, difficulty: this.match.difficulty, beasts: this.match.beasts,
      place: standings(live).indexOf(HUMAN) + 1, end: fingerprint(live),
    }
    return newReplay(info, encodeStart(this.recording.start), [...live.orders])
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
    this.world = this.live
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
    for (const rival of this.rivals) rival.update(this.world, dt)
    tick(this.world, dt)
    this.recording.note(this.world)
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
  const size = saved.size && MAP_SIZES.includes(saved.size) ? saved.size : DEFAULT_SETTINGS.size
  return {
    size,
    type: saved.type === 'random' || (saved.type && MAP_TYPES.includes(saved.type)) ? saved.type : DEFAULT_SETTINGS.type,
    season: saved.season === 'random' || (saved.season && SEASONS.includes(saved.season)) ? saved.season : 'random',
    beasts: saved.beasts && BEASTS.includes(saved.beasts) ? saved.beasts : 'few',
    rivals: Math.min(Math.max(1, Math.round(saved.rivals ?? 1)), MAX_RIVALS[size]) || 1,
    difficulty: saved.difficulty && DIFFICULTIES.includes(saved.difficulty) ? saved.difficulty : 'normal',
  }
}
