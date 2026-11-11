// Cleans a short recording: the hiss of the background is measured where nothing else sounds,
// then taken out of every moment of the recording (spectral subtraction), and the quiet lead-in is cut off

const FRAME = 1024 // samples per analysed slice
const HOP = FRAME / 4 // slices overlap, so the result is smooth
const OVERSUBTRACT = 2 // takes out a bit more than the measured hiss, so none of it is left
const FLOOR = 0.04 // what is left of a slice that was pure hiss

export interface Cleaning {
  noise: number // seconds at the start that hold only the background
  lowCut: number // Hz: rumble below this goes
  highCut: number // Hz: hiss above this goes
  fadeOut: number // seconds
}

export function cleanRecording(input: Float32Array, rate: number, cleaning: Cleaning): Float32Array {
  const window = Float32Array.from({ length: FRAME }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME))
  const frames = Math.floor((input.length - FRAME) / HOP) + 1
  const spectra: { re: Float32Array; im: Float32Array }[] = []
  for (let f = 0; f < frames; f++) {
    const re = new Float32Array(FRAME)
    const im = new Float32Array(FRAME)
    for (let i = 0; i < FRAME; i++) re[i] = input[f * HOP + i] * window[i]
    fft(re, im, false)
    spectra.push({ re, im })
  }

  // The background's loudness at each pitch, averaged over the lead-in
  const noiseFrames = Math.max(1, Math.floor((cleaning.noise * rate - FRAME) / HOP))
  const noise = new Float32Array(FRAME / 2 + 1)
  for (let f = 0; f < noiseFrames; f++) {
    for (let k = 0; k <= FRAME / 2; k++) noise[k] += Math.hypot(spectra[f].re[k], spectra[f].im[k]) / noiseFrames
  }

  const output = new Float32Array(input.length)
  const gains = new Float32Array(FRAME / 2 + 1).fill(FLOOR)
  for (let f = 0; f < frames; f++) {
    const { re, im } = spectra[f]
    for (let k = 0; k <= FRAME / 2; k++) {
      const hz = (k * rate) / FRAME
      const level = Math.hypot(re[k], im[k])
      let gain = Math.max(FLOOR, 1 - (OVERSUBTRACT * noise[k]) / (level + 1e-12))
      if (hz < cleaning.lowCut || hz > cleaning.highCut) gain = 0
      // Gains open fast and close slowly, which keeps the result from twittering
      gains[k] = gain > gains[k] ? gain : gains[k] * 0.7 + gain * 0.3
      re[k] *= gains[k]
      im[k] *= gains[k]
      if (k > 0 && k < FRAME / 2) {
        re[FRAME - k] = re[k]
        im[FRAME - k] = -im[k]
      }
    }
    fft(re, im, true)
    for (let i = 0; i < FRAME; i++) output[f * HOP + i] += (re[i] * window[i]) / 1.5 // Hann² at a quarter hop adds up to 1.5
  }

  // Drop the lead-in, fade the edges, bring it to a steady loudness
  const start = Math.floor(cleaning.noise * rate)
  const clip = output.slice(start)
  const fadeIn = Math.floor(rate * 0.02)
  const fadeOut = Math.floor(rate * cleaning.fadeOut)
  for (let i = 0; i < fadeIn; i++) clip[i] *= i / fadeIn
  for (let i = 0; i < fadeOut; i++) clip[clip.length - 1 - i] *= i / fadeOut
  const peak = clip.reduce((max, value) => Math.max(max, Math.abs(value)), 0) || 1
  for (let i = 0; i < clip.length; i++) clip[i] *= 0.9 / peak
  return clip
}

// In-place radix-2 FFT; `inverse` turns a spectrum back into sound
function fft(re: Float32Array, im: Float32Array, inverse: boolean): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const wr = Math.cos(angle * k)
        const wi = Math.sin(angle * k)
        const a = start + k
        const b = a + size / 2
        const tr = re[b] * wr - im[b] * wi
        const ti = re[b] * wi + im[b] * wr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) re[i] /= n
}
