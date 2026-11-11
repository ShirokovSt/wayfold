import { readStored, store } from '../storage'
import type { SoundEvent } from './events'
import { loadRecordings, playRecording } from './recordings'

const SOUND_KEY = 'wayfold.sound'
const VOLUME_KEY = 'wayfold.volume'
const LOUDEST = 0.8 // the output at full volume, so a few sounds at once do not crackle
const REPEAT_GAP = 0.1 // seconds: the same sound twice in a row would only be louder

export interface Audio {
  context: AudioContext
  output: GainNode // everything goes out through here: silent while muted
  effects: GainNode // the volume of the game's sounds; the music has its own
  noise: AudioBuffer
}

interface Tone {
  wave?: OscillatorType
  from: number // pitch in Hz at the start
  to?: number // pitch it slides to
  length: number // seconds until it fades out
  volume: number
}

// Every sound is made here from plain waves and noise, the way the board is drawn in code.
// The speaker in the top bar mutes everything at once, music included
class Sounds {
  muted = readStored(SOUND_KEY) === 'off'
  volume = savedVolume(VOLUME_KEY, 0.75) // of the game's sounds, 0..1
  private audio: Audio | null = null
  private lastPlayed = new Map<SoundEvent, number>()

  toggle(): void {
    this.setMuted(!this.muted)
  }

  // Moving a volume also switches the sound back on
  unmute(): void {
    if (this.muted) this.setMuted(false)
  }

  setVolume(volume: number): void {
    this.volume = volume
    store(VOLUME_KEY, String(volume))
    this.unmute()
    this.applyVolume()
  }

  play(event: SoundEvent): void {
    if (this.muted || this.volume === 0) return
    const audio = this.output()
    const time = audio.context.currentTime
    if (time - (this.lastPlayed.get(event) ?? -1) < REPEAT_GAP) return
    this.lastPlayed.set(event, time)
    RECIPES[event](audio, time)
  }

  // A soft ping of its own, to hear the volume while setting it
  preview(): void {
    if (this.muted || this.volume === 0) return
    const audio = this.output()
    const time = audio.context.currentTime
    tone(audio, time, { from: NOTE.G5, length: 0.35, volume: 0.25 })
    tone(audio, time, { wave: 'triangle', from: NOTE.G5 * 2, length: 0.15, volume: 0.05 })
  }

  // Browsers allow sound only after the player has clicked the page; call it after a click
  output(): Audio {
    if (!this.audio) {
      const context = new AudioContext()
      const output = context.createGain()
      output.connect(context.destination)
      const effects = context.createGain()
      effects.connect(output)
      this.audio = { context, output, effects, noise: whiteNoise(context) }
      this.applyVolume()
      loadRecordings(context)
      // A hidden tab stops the game, so the sound waits for it too
      document.addEventListener('visibilitychange', () => {
        void (document.hidden ? context.suspend() : context.resume())
      })
    }
    if (this.audio.context.state === 'suspended' && !document.hidden) void this.audio.context.resume()
    return this.audio
  }

  private setMuted(muted: boolean): void {
    this.muted = muted
    store(SOUND_KEY, muted ? 'off' : 'on')
    this.applyVolume()
  }

  private applyVolume(): void {
    if (!this.audio) return
    this.audio.output.gain.value = this.muted ? 0 : LOUDEST
    this.audio.effects.gain.value = this.volume
  }
}

export const sounds = new Sounds()

// A saved volume from 0 to 1, or the given one
export function savedVolume(key: string, fallback: number): number {
  const volume = Number(readStored(key) ?? fallback)
  return volume >= 0 && volume <= 1 ? volume : fallback
}

const NOTE = { C4: 261.6, Eb4: 311.1, G4: 392, C5: 523.3, E5: 659.3, G5: 784, C6: 1046.5 }

const RECIPES: Record<SoundEvent, (audio: Audio, time: number) => void> = {
  // A drum beat: a squad sets off
  send: (audio, time) => {
    tone(audio, time, { from: 150, to: 55, length: 0.18, volume: 0.5 })
    hiss(audio, time, 200, 1, 0.05, 0.15)
  },
  // A bright chime: the village is yours
  capture: (audio, time) => {
    ;[NOTE.C5, NOTE.E5, NOTE.G5].forEach((pitch, i) =>
      tone(audio, time + i * 0.08, { wave: 'triangle', from: pitch, length: 0.5, volume: 0.18 }))
  },
  // A low thud: a village of yours is lost
  loss: (audio, time) => {
    tone(audio, time, { from: 110, to: 50, length: 0.6, volume: 0.5 })
    tone(audio, time + 0.12, { wave: 'triangle', from: NOTE.Eb4 / 2, length: 0.6, volume: 0.15 })
  },
  // A knock on a shield: an attack broke against the village
  repelled: (audio, time) => {
    hiss(audio, time, 900, 4, 0.08, 0.5)
    tone(audio, time, { wave: 'triangle', from: 260, to: 180, length: 0.1, volume: 0.25 })
  },
  // Two hammer blows: something is built
  build: (audio, time) => {
    for (const delay of [0, 0.16]) {
      tone(audio, time + delay, { wave: 'square', from: 1400, length: 0.07, volume: 0.06 })
      hiss(audio, time + delay, 3000, 2, 0.05, 0.25)
    }
  },
  // A bell, its overtones out of tune like a real one's: the village becomes a town
  town: (audio, time) => {
    ;[1, 2.76, 5.4].forEach((ratio, i) =>
      tone(audio, time, { from: 440 * ratio, length: 1.6 / (i + 1), volume: 0.2 / (i + 1) }))
  },
  // Wolves: real recordings
  howl: (audio, time) => playRecording(audio.context, audio.effects, 'howl', time, 0.35),
  growl: (audio, time) => playRecording(audio.context, audio.effects, 'growl', time, 0.45),
  victory: (audio, time) => melody(audio, time, [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.14),
  defeat: (audio, time) => melody(audio, time, [NOTE.G4, NOTE.Eb4, NOTE.C4], 0.28),
}

// The last note of a tune rings longer
function melody(audio: Audio, time: number, notes: number[], beat: number): void {
  notes.forEach((pitch, i) => {
    const length = i === notes.length - 1 ? beat * 4 : beat * 1.6
    tone(audio, time + i * beat, { wave: 'triangle', from: pitch, length, volume: 0.2 })
  })
}

function tone(audio: Audio, time: number, { wave = 'sine', from, to = from, length, volume }: Tone): void {
  const oscillator = audio.context.createOscillator()
  oscillator.type = wave
  oscillator.frequency.setValueAtTime(from, time)
  if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, time + length)
  oscillator.connect(fade(audio, time, length, volume))
  oscillator.start(time)
  oscillator.stop(time + length)
}

// A burst of noise around one pitch: knocks and blows
function hiss(audio: Audio, time: number, pitch: number, sharpness: number, length: number, volume: number): void {
  const source = audio.context.createBufferSource()
  source.buffer = audio.noise
  const filter = audio.context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = pitch
  filter.Q.value = sharpness
  source.connect(filter).connect(fade(audio, time, length, volume))
  source.start(time)
  source.stop(time + length)
}

// A volume that jumps up at once and dies away, like a struck thing
function fade(audio: Audio, time: number, length: number, volume: number): GainNode {
  const gain = audio.context.createGain()
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + length)
  gain.connect(audio.effects)
  return gain
}

function whiteNoise(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}
