import growlUrl from '../assets/sounds/growl.mp3'
import howlUrl from '../assets/sounds/howl.mp3'
import { type Cleaning, cleanRecording } from './cleanRecording'

// Real recordings, free to use (CC0) from freesound.org: a wild wolf in Wrangell-St. Elias National Park
// by betchkal, and a dog's snarl by DaniloSFX. Cut short and cleaned of the background hiss
export type Recording = 'howl' | 'growl'

const SOURCES: Record<Recording, { url: string; cleaning: Cleaning }> = {
  howl: { url: howlUrl, cleaning: { noise: 0.55, lowCut: 150, highCut: 5000, fadeOut: 1.2 } },
  growl: { url: growlUrl, cleaning: { noise: 0.33, lowCut: 60, highCut: 6000, fadeOut: 0.15 } },
}

const ready = new Map<Recording, AudioBuffer>()
let loading = false

// Fetched, decoded and cleaned once, as soon as there is sound; until a recording is ready it is just not heard
export function loadRecordings(context: AudioContext): void {
  if (loading) return
  loading = true
  for (const [name, { url, cleaning }] of Object.entries(SOURCES) as [Recording, (typeof SOURCES)[Recording]][]) {
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((decoded) => {
        const samples = cleanRecording(decoded.getChannelData(0), decoded.sampleRate, cleaning)
        const buffer = context.createBuffer(1, samples.length, decoded.sampleRate)
        buffer.getChannelData(0).set(samples)
        ready.set(name, buffer)
      })
      .catch(() => {}) // without the file the game simply stays quiet here
  }
}

export function playRecording(context: AudioContext, output: AudioNode, name: Recording, time: number, volume: number): void {
  const buffer = ready.get(name)
  if (!buffer) return
  const source = context.createBufferSource()
  source.buffer = buffer
  const gain = context.createGain()
  gain.gain.value = volume
  source.connect(gain).connect(output)
  source.start(time)
}
