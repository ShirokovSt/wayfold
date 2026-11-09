// The little medieval band the music is played on: lute, recorder, frame drum and bells, all made from waves and noise

export interface Band {
  context: AudioContext
  input: AudioNode // everything plays in here: it goes on dry and through the hall
  strings: AudioNode // the lute's own soft filter in front of the input
  noise: AudioBuffer
}

export type DrumStroke = 'boom' | 'tap' | 'jingle'

const LUTE_DECAY = 0.998 // how long a string rings
const LUTE_SECONDS = 3

// Builds the band's sound path: a soft filter for the strings, and a small stone hall around everything
export function makeBand(context: AudioContext, output: AudioNode, noise: AudioBuffer, hall: number): Band {
  const input = context.createGain()
  input.connect(output)
  const reverb = context.createConvolver()
  reverb.buffer = hallEcho(context)
  const wet = context.createGain()
  wet.gain.value = hall
  input.connect(reverb).connect(wet).connect(output)
  const strings = context.createBiquadFilter()
  strings.type = 'lowpass'
  strings.frequency.value = 1800
  strings.Q.value = 0.6
  strings.connect(input)
  return { context, input, strings, noise }
}

export function lute(band: Band, time: number, pitch: number, volume: number, ring = 1.8): void {
  const { context } = band
  const { buffer, speed } = pluckedString(context, pitch)
  const source = context.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = speed // lands the string exactly in tune
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(volume, time + 0.004) // no click at the pluck
  gain.gain.setValueAtTime(volume, time + ring - 0.3)
  gain.gain.linearRampToValueAtTime(0, time + ring)
  source.connect(gain).connect(band.strings)
  source.start(time)
  source.stop(time + ring)
}

// A soft sine with two faint overtones, a slow vibrato and a puff of breath at the start
export function recorder(band: Band, time: number, pitch: number, length: number, volume: number): void {
  const { context } = band
  const pipe = context.createOscillator()
  pipe.setPeriodicWave(fluteWave(context))
  pipe.frequency.value = pitch
  const vibrato = context.createOscillator()
  vibrato.frequency.value = 5.2
  const depth = context.createGain() // in cents, growing in after the attack
  depth.gain.setValueAtTime(0, time)
  depth.gain.linearRampToValueAtTime(7, time + 0.3)
  vibrato.connect(depth).connect(pipe.detune)

  const end = time + length + 0.06
  const envelope = context.createGain()
  envelope.gain.setValueAtTime(0, time)
  envelope.gain.linearRampToValueAtTime(volume, time + 0.035)
  envelope.gain.linearRampToValueAtTime(volume * (1 - 0.1 * Math.min(1, length / 1.5)), time + length)
  envelope.gain.linearRampToValueAtTime(0, end)
  pipe.connect(envelope).connect(band.input)

  const breath = noiseThrough(band, 'bandpass', pitch * 2, 3)
  breath.gain.gain.setValueAtTime(volume * 0.24, time)
  breath.gain.gain.setTargetAtTime(volume * 0.04, time, 0.025)
  breath.gain.gain.setValueAtTime(volume * 0.04, time + length)
  breath.gain.gain.linearRampToValueAtTime(0, end)

  for (const node of [pipe, vibrato, breath.source]) {
    node.start(time)
    node.stop(end)
  }
}

export function drum(band: Band, time: number, stroke: DrumStroke, volume: number): void {
  const { context } = band
  if (stroke === 'jingle') {
    const jingle = noiseThrough(band, 'highpass', 6000, 0.7)
    struck(jingle.gain.gain, time, volume * 0.8, 0.05)
    jingle.source.start(time)
    jingle.source.stop(time + 0.3)
    return
  }
  // The skin: a low note that drops as it rings, and a slap of noise
  const boom = stroke === 'boom'
  const skin = context.createOscillator()
  skin.frequency.setValueAtTime(boom ? 110 : 190, time)
  if (boom) skin.frequency.setTargetAtTime(60, time, 0.04)
  const body = context.createGain()
  struck(body.gain, time, boom ? volume : volume * 0.6, boom ? 0.18 : 0.05)
  skin.connect(body).connect(band.input)
  const slap = noiseThrough(band, 'bandpass', boom ? 300 : 1500, 1)
  struck(slap.gain.gain, time, boom ? volume * 0.6 : volume, 0.02)
  for (const node of [skin, slap.source]) {
    node.start(time)
    node.stop(time + (boom ? 1 : 0.3))
  }
}

// Partials out of tune like a real bell's, the high ones dying first
export function bell(band: Band, time: number, pitch: number, volume: number): void {
  const { context } = band
  for (const [ratio, level, length] of [[1, 1, 2.5], [2, 0.3, 1.6], [2.76, 0.25, 1], [5.4, 0.08, 0.5]]) {
    const partial = context.createOscillator()
    partial.frequency.value = pitch * ratio
    const gain = context.createGain()
    struck(gain.gain, time, volume * level, length / 4)
    partial.connect(gain).connect(band.input)
    partial.start(time)
    partial.stop(time + length * 1.5)
  }
}

// Jumps up at once, then dies away exponentially with the given time constant
function struck(gain: AudioParam, time: number, volume: number, decay: number): void {
  gain.setValueAtTime(volume, time)
  gain.setTargetAtTime(0, time, decay)
}

function noiseThrough(band: Band, type: BiquadFilterType, frequency: number, q: number) {
  const { context } = band
  const source = context.createBufferSource()
  source.buffer = band.noise
  source.loop = true
  const filter = context.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = q
  const gain = context.createGain()
  source.connect(filter).connect(gain).connect(band.input)
  return { source, gain }
}

let flute: PeriodicWave | null = null

function fluteWave(context: AudioContext): PeriodicWave {
  flute ??= context.createPeriodicWave([0, 0, 0, 0], [0, 1, 0.22, 0.1], { disableNormalization: true })
  return flute
}

const strings = new Map<number, { buffer: AudioBuffer; speed: number }>()

// Karplus–Strong: a loop of soft noise that loses its high notes on every pass sounds like a plucked gut string.
// The loop is a whole number of samples long, so the note is played a touch faster or slower to be exactly in tune
function pluckedString(context: AudioContext, pitch: number): { buffer: AudioBuffer; speed: number } {
  const known = strings.get(pitch)
  if (known) return known
  const rate = context.sampleRate
  const period = Math.max(3, Math.round(rate / pitch + 1))
  const speed = pitch / (rate / (period - 1)) // the three-tap filter makes the loop one sample shorter
  const loop = new Float32Array(period)
  let previous = 0
  for (let i = 0; i < period; i++) {
    const noise = Math.random() * 2 - 1
    loop[i] = (noise + previous) / 2
    previous = noise
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < period; i++) loop[i] = (loop[i] + loop[(i + 1) % period]) / 2
  }
  const mean = loop.reduce((sum, value) => sum + value, 0) / period
  const buffer = context.createBuffer(1, Math.ceil(rate * LUTE_SECONDS * speed) + 2, rate)
  const out = buffer.getChannelData(0)
  for (let i = 0; i < period; i++) loop[i] = (loop[i] - mean) * 1.2
  for (let i = 0; i < out.length; i++) {
    const j = i % period
    out[i] = loop[j]
    loop[j] = LUTE_DECAY * (0.25 * loop[j] + 0.5 * loop[(j + 1) % period] + 0.25 * loop[(j + 2) % period])
  }
  const string = { buffer, speed }
  strings.set(pitch, string)
  return string
}

// The echo of a small stone hall: noise dying away within about a second
function hallEcho(context: AudioContext): AudioBuffer {
  const rate = context.sampleRate
  const buffer = context.createBuffer(2, Math.floor(rate * 1.5), rate)
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    let energy = 0
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / rate / 0.16)
      energy += data[i] * data[i]
    }
    const scale = 1 / Math.sqrt(energy)
    for (let i = 0; i < data.length; i++) data[i] *= scale
  }
  return buffer
}
