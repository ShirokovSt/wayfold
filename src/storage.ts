// Choices remembered in the browser. Storage can be unavailable, e.g. in private mode:
// then nothing is remembered, but the game still works

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not saved: the choice is just forgotten on reload
  }
}
