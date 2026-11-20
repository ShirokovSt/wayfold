import { Recording, restoreMap } from '../sim/replay'
import type { SeekRequest, SeekResult } from './seek'

let recording: Recording | undefined
let current: AbortController | undefined

// Posted tasks let the worker receive new seek requests between batches without a timer delay.
const batches = new MessageChannel()
const waiting: (() => void)[] = []
batches.port1.onmessage = () => waiting.shift()?.()

function yieldBatch(): Promise<void> {
  return new Promise((resume) => {
    waiting.push(resume)
    batches.port2.postMessage(null)
  })
}

self.onmessage = async ({ data }: MessageEvent<SeekRequest | null>): Promise<void> => {
  current?.abort()
  if (!data) return

  const task = current = new AbortController()
  let world = null
  try {
    const checkpoint = data.checkpoint && restoreMap(data.checkpoint)
    if (data.recording && checkpoint) {
      const { orders, length } = data.recording
      recording = new Recording(checkpoint, orders, () => length)
    } else if (checkpoint) {
      recording?.note(checkpoint)
    }
    world = await recording!.atInBatches(data.ticks, task.signal, yieldBatch)
  } catch {
    // The previous frame remains on screen if the replay cannot be calculated.
  }
  if (!task.signal.aborted) {
    self.postMessage({ id: data.id, world } satisfies SeekResult)
  }
}
