import { Recording, restoreMap } from '../sim/replay'
import type { Order, World } from '../sim/world'

export interface SeekRequest {
  id: number
  ticks: number
  checkpoint?: World
  recording?: { length: number; orders: Order[] }
}

export interface SeekResult {
  id: number
  world: World | null
}

// One worker per replay, started only when a seek needs to calculate beyond the local checkpoints.
export class ReplaySeek {
  private worker: Worker | null = null
  private workerUnavailable = false
  private readonly shared = new WeakSet<World>()
  private pending: { id: number; ticks: number; done: (world: World | null) => void } | null = null
  private fallback: AbortController | null = null
  private nextId = 0

  constructor(private readonly recording: Recording) {}

  get target(): number | null {
    return this.pending?.ticks ?? null
  }

  seek(ticks: number, checkpoint: World, done: (world: World | null) => void): void {
    this.fallback?.abort()
    const id = ++this.nextId
    this.pending = { id, ticks, done }
    if (this.workerUnavailable) {
      void this.seekInBatches()
      return
    }

    try {
      const first = this.worker === null
      const worker = this.worker ??= this.startWorker()
      const request: SeekRequest = { id, ticks }
      if (!this.shared.has(checkpoint)) request.checkpoint = checkpoint
      if (first) request.recording = { length: this.recording.length, orders: this.recording.orders }
      worker.postMessage(request)
      this.shared.add(checkpoint)
    } catch {
      this.useFallback()
    }
  }

  cancel(): void {
    if (!this.pending) return
    this.pending = null
    this.fallback?.abort()
    this.worker?.postMessage(null)
  }

  dispose(): void {
    this.pending = null
    this.fallback?.abort()
    this.worker?.terminate()
  }

  private startWorker(): Worker {
    const worker = new Worker(new URL('./seek.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }: MessageEvent<SeekResult>) => this.complete(data)
    worker.onerror = (event) => {
      event.preventDefault()
      this.useFallback()
    }
    worker.onmessageerror = () => this.useFallback()
    return worker
  }

  private useFallback(): void {
    this.worker?.terminate()
    this.worker = null
    this.workerUnavailable = true
    void this.seekInBatches()
  }

  private async seekInBatches(): Promise<void> {
    if (!this.pending) return
    const { id, ticks } = this.pending
    const fallback = this.fallback = new AbortController()
    try {
      const world = await this.recording.atInBatches(ticks, fallback.signal)
      this.complete({ id, world })
    } catch {
      this.complete({ id, world: null })
    }
  }

  private complete({ id, world }: SeekResult): void {
    const request = this.pending
    if (!request || request.id !== id) return
    this.pending = null
    this.fallback = null
    request.done(world && restoreMap(world))
  }
}
