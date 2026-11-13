// Choices remembered in the browser. Storage can be unavailable, e.g. in private mode:
// then nothing is remembered, but the game still works

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// False when it could not be saved, e.g. the storage is full: the choice is just forgotten on reload
export function store(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function forget(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing stored to remove
  }
}
