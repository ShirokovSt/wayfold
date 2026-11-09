import { readStored, store } from '../storage'
import { bell, drum, lute, makeBand, recorder, type Band } from './instruments'
import { savedVolume, sounds } from './sounds'
import { type Bar, type Lead, type Theme, type Tune, TUNES, parsePart, pitchOf } from './tunes'

const VOLUME_KEY = 'wayfold.musicVolume'
const OLD_SWITCH_KEY = 'wayfold.music' // the music button of 0.3.0: 'off' becomes a volume of zero
const LEVEL = 0.4 // the music stays under the sounds of the game
const AHEAD = 1 // seconds of music written ahead of time
const FADE = 1.5 // seconds to fade a tune in or out
const LUTE_LEAD = 2 // a plucked tune sounds quieter than a blown one, so the lute plays it louder

// One bar to play: the tune's notes over the lute and drums
interface Slot {
  bar: Bar
  lead: Lead
  bell: number | null // pitch of a bell at the bar's start
  intro: boolean // no tune yet: only the drums or only the lute
}

// Plays one tune round and round, writing each bar a little before it sounds
class Player {
  private readonly slots: Slot[]
  private index = 0

  constructor(
    private readonly band: Band,
    private readonly tune: Tune,
    private next: number,
  ) {
    this.slots = slotsOf(tune)
  }

  writeUntil(time: number): void {
    if (this.next < this.band.context.currentTime) this.next = this.band.context.currentTime // after a hidden tab
    while (this.next < time) {
      this.play(this.slots[this.index], this.next)
      this.next += this.tune.beats * this.tune.unit
      this.index = (this.index + 1) % this.slots.length
    }
  }

  private play(slot: Slot, start: number): void {
    const { band, tune } = this
    if (!slot.intro || tune.intro === 'lute') {
      for (const [at, interval, volume] of tune.accompaniment) lute(band, start + at * tune.unit, slot.bar.root * interval, volume)
    }
    if (!slot.intro || tune.intro === 'drums') {
      for (const [at, stroke, volume] of tune.drums) drum(band, start + at * tune.unit, stroke, volume)
    }
    if (slot.bell && tune.bells) bell(band, start, slot.bell, tune.bells.volume)
    let time = start
    for (const note of slot.bar.notes) {
      const length = note.units * tune.unit
      if (slot.lead !== 'flute') lute(band, time, note.pitch / 2, tune.flute * LUTE_LEAD, 1.6)
      if (slot.lead !== 'lute') recorder(band, time, note.pitch, length * 0.92, slot.lead === 'both' ? tune.flute * 0.6 : tune.flute)
      time += length
    }
  }
}

// The whole tune as a row of bars; the intro sits on the first root, the bells take turns every few bars of a section
function slotsOf(tune: Tune): Slot[] {
  const slots: Slot[] = []
  for (const [part, lead] of tune.sections) {
    parsePart(part).forEach((bar, i) => {
      const bells = tune.bells
      const ring = bells && i % bells.every === 0 ? pitchOf(bells.notes[(i / bells.every) % bells.notes.length]) : null
      slots.push({ bar, lead, bell: ring, intro: false })
    })
  }
  if (tune.intro !== 'none') {
    const intro: Slot = { bar: { notes: [], root: slots[0].bar.root }, lead: 'flute', bell: null, intro: true }
    slots.unshift(intro, intro)
  }
  return slots
}

// The music of the menu and of each season; switching fades one tune out and the next one in
class Music {
  volume = savedVolume(VOLUME_KEY, readStored(OLD_SWITCH_KEY) === 'off' ? 0 : 0.75) // 0 is off
  private theme: Theme = 'menu'
  private awake = false // after the first click, when the browser allows sound
  private player: Player | null = null
  private bus: GainNode | null = null
  private mixer: GainNode | null = null // the music's own volume
  private timer = 0

  // Browsers allow sound only after a click, so every click makes sure the sound is awake
  start(): void {
    this.awake = true
    sounds.output()
    if (this.volume > 0 && !this.player) this.begin()
  }

  play(theme: Theme): void {
    if (theme === this.theme) return
    this.theme = theme
    if (this.player) {
      this.end()
      this.begin()
    }
  }

  // At zero the music stops altogether, and comes back when turned up
  setVolume(volume: number): void {
    this.volume = volume
    store(VOLUME_KEY, String(volume))
    sounds.unmute()
    if (this.mixer) this.mixer.gain.value = volume
    if (volume === 0) this.end()
    else if (this.awake && !this.player) this.begin()
  }

  // Steps aside for a few seconds, so the tune of a victory or a defeat sounds clear
  hush(seconds: number): void {
    if (!this.bus) return
    const gain = this.bus.gain
    const now = this.bus.context.currentTime
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(0, now + 0.5)
    gain.setValueAtTime(0, now + seconds)
    gain.linearRampToValueAtTime(LEVEL, now + seconds + 3)
  }

  private begin(): void {
    const audio = sounds.output()
    const { context } = audio
    const now = context.currentTime
    const tune = TUNES[this.theme]
    if (!this.mixer) {
      this.mixer = context.createGain()
      this.mixer.gain.value = this.volume
      this.mixer.connect(audio.output)
    }
    const bus = context.createGain()
    bus.gain.setValueAtTime(0, now)
    bus.gain.linearRampToValueAtTime(LEVEL, now + FADE)
    bus.connect(this.mixer)
    this.bus = bus
    this.player = new Player(makeBand(context, bus, audio.noise, tune.hall), tune, now + 0.3)
    clearInterval(this.timer)
    this.timer = window.setInterval(() => this.player?.writeUntil(context.currentTime + AHEAD), 250)
    this.player.writeUntil(now + AHEAD)
  }

  // Fades out; the notes already written fall silent with their bus
  private end(): void {
    clearInterval(this.timer)
    this.timer = 0
    this.player = null
    const bus = this.bus
    if (!bus) return
    this.bus = null
    const now = bus.context.currentTime
    bus.gain.cancelScheduledValues(now)
    bus.gain.setValueAtTime(bus.gain.value, now)
    bus.gain.linearRampToValueAtTime(0, now + FADE)
    setTimeout(() => bus.disconnect(), (FADE + AHEAD + 0.5) * 1000)
  }
}

export const music = new Music()
