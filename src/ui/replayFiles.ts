import { REPLAY_EXTENSION, type Replay, toBytes } from '../replays/format'

// Saves the replay as a file, named after when the match ended: wayfold-2026-11-14-1530.wfreplay
export async function downloadReplay(replay: Replay): Promise<void> {
  const date = new Date(replay.info.savedAt)
  const two = (value: number) => String(value).padStart(2, '0')
  const name = `wayfold-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}`
  const url = URL.createObjectURL(new Blob([await toBytes(replay) as BlobPart], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name + REPLAY_EXTENSION
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000) // once the browser has taken the file
}
