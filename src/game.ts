import { DIFFICULTIES, type Difficulty, Rival } from './ai/rival'
import { createRandom } from './core/rng'
import { encodeMapCode, type GeneratedMatch } from './mapCode'
import { DEFAULT_SETTINGS, type MapSettings, createWorld } from './sim/mapgen'
import { MAX_RIVALS } from './sim/rules'
import { type Replay, newReplay } from './replays/format'
import { ReplaySeek } from './replays/seek'
import { Recording } from './sim/replay'
import { decodeStart, encodeStart, fingerprint } from './sim/snapshot'
import { standings, tick } from './sim/tick'
import { BEASTS, type Beasts, HUMAN, MAP_SIZES, MAP_TYPES, SEASONS, type Season, type World } from './sim/world'
import { readStored, store } from './storage'
import { tutorialWorld } from './tutorial/tutorial'

const SETTINGS_KEY = 'wayfold.map'
const INLINE_SEEK_TICKS = 20 // recalculate at most one second of play on the UI thread

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
  private savedPlayback: {
    replay: Replay
    recording: Recording
    previousWorld: World
    wasWatching: boolean
  } | null = null
  private rivals: Rival[] = [] // none in the tutorial: the rival there only waits
  private recording!: Recording
  private replaySeek: ReplaySeek | null = null
  private live!: World
  private match: GeneratedMatch | null = null // what the match was started with; none for the tutorial

  constructor(seed: number) {
    this.restart(seed)
  }

  restart(seed: number, settings = this.settings): void {
    seed >>>= 0 // the generator uses 32-bit seeds
    const { size, beasts, rivals, difficulty } = settings
    const world = createWorld(seed, { ...settings, players: rivals + 1 })
    const map = { seed, size, beasts, rivals, type: world.mapType, season: world.map.season }
    this.begin(world, { map, difficulty })
  }

  startFromMap({ map, difficulty }: GeneratedMatch): void {
    const { seed, ...settings } = map
    this.restart(seed, { ...settings, difficulty })
  }

  get mapCode(): string | null {
    return this.match && encodeMapCode(this.match)
  }

  rematch(): boolean {
    if (!this.match) return false
    this.startFromMap(this.match)
    return true
  }

  startTutorial(): void {
    this.begin(tutorialWorld())
  }

  get opened(): Replay | null {
    return this.savedPlayback?.replay ?? null
  }

  // A saved replay has its own recording; the current match stays where it was.
  open(replay: Replay): void {
    const start = decodeStart(replay.start)
    const recording = new Recording(start, replay.orders, () => replay.info.ticks)
    this.disposeSeek()
    this.savedPlayback = {
      replay,
      recording,
      previousWorld: this.savedPlayback?.previousWorld ?? this.world,
      wasWatching: this.savedPlayback?.wasWatching ?? this.watching,
    }
    this.world = start
    this.watching = true
  }

  // The library is still open when the player returns to the previous board.
  close(): void {
    const playback = this.savedPlayback
    if (!playback) return
    this.disposeSeek()
    this.savedPlayback = null
    this.world = playback.previousWorld
    this.watching = playback.wasWatching
    this.paused = true
  }

  private begin(world: World, match: GeneratedMatch | null = null): void {
    this.disposeSeek()
    this.world = world
    this.live = world
    this.recording = Recording.of(world)
    this.started = false
    this.watching = false
    this.savedPlayback = null
    this.match = match
    this.rivals = match
      ? world.players.filter((player) => player !== HUMAN)
        .map((player, i) => new Rival(player, createRandom(match.map.seed + 1 + i * 7), match.difficulty))
      : []
  }

  // The finished match, to be kept and watched again later; none for the tutorial
  replay(): Replay | null {
    const live = this.live
    if (!this.match || live.winner === null) return null
    const info = {
      savedAt: Date.now(), ticks: live.ticks, mapType: live.mapType, size: this.match.map.size, season: live.map.season,
      players: live.players.length, difficulty: this.match.difficulty, beasts: this.match.map.beasts,
      place: standings(live).indexOf(HUMAN) + 1, end: fingerprint(live),
    }
    return newReplay(info, encodeStart(this.recording.start), [...live.orders])
  }

  get replayLength(): number {
    return this.activeRecording.length
  }

  private get activeRecording(): Recording {
    return this.savedPlayback?.recording ?? this.recording
  }

  // Watching starts from the beginning; jumping to a moment rebuilds the world as it was then
  watch(ticks = 0): void {
    this.replaySeek?.cancel()
    this.watching = true
    this.world = this.activeRecording.at(ticks)
  }

  get seekingTo(): number | null {
    return this.replaySeek?.target ?? null
  }

  seek(ticks: number, done: (applied: boolean) => void): void {
    const recording = this.activeRecording
    const checkpoint = recording.checkpoint(ticks)
    if (ticks - checkpoint.ticks <= INLINE_SEEK_TICKS) {
      this.watch(ticks)
      done(true)
      return
    }
    this.replaySeek ??= new ReplaySeek(recording)
    this.replaySeek.seek(ticks, checkpoint, (world) => {
      if (world) {
        this.world = world
        recording.note(world)
      }
      done(world !== null)
    })
  }

  stopWatching(): void {
    this.disposeSeek()
    this.watching = false
    this.world = this.live
  }

  private disposeSeek(): void {
    this.replaySeek?.dispose()
    this.replaySeek = null
  }

  changeSettings(settings: MatchSettings): void {
    this.settings = settings
    store(SETTINGS_KEY, JSON.stringify(settings))
  }

  update(dt: number): void {
    if (this.paused || this.seekingTo !== null || this.world.winner !== null) return
    if (this.watching) {
      this.activeRecording.step(this.world)
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
