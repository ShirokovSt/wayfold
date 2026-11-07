import { en, ru, type Strings } from './strings'

export type Language = 'en' | 'ru'
export const LANGUAGES: Language[] = ['en', 'ru']

const DICTIONARIES: Record<Language, Strings> = { en, ru }
const STORAGE_KEY = 'wayfold.language'

let language: Language = loadLanguage()
const listeners: (() => void)[] = []

// Texts in the current language; `t` for "translate" is the usual name for this
export function t(): Strings {
  return DICTIONARIES[language]
}

export function currentLanguage(): Language {
  return language
}

export function setLanguage(next: Language): void {
  if (next === language) return
  language = next
  document.documentElement.lang = next
  saveLanguage(next)
  for (const listener of listeners) listener()
}

// Returns a function that stops listening
export function onLanguageChange(listener: () => void): () => void {
  listeners.push(listener)
  return () => listeners.splice(listeners.indexOf(listener), 1)
}

// The choice is remembered in the browser; storage can be unavailable, e.g. in private mode
function loadLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return LANGUAGES.find((l) => l === saved) ?? 'en'
  } catch {
    return 'en'
  }
}

function saveLanguage(value: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Not saved: the game still works, the choice is just forgotten on reload
  }
}
