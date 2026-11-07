import { readStored, store } from '../storage'
import { en, ru, type Strings } from './strings'

export type Language = 'en' | 'ru'
export const LANGUAGES: Language[] = ['en', 'ru']
// Each language is named in itself, so anyone can find their own
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', ru: 'Русский' }

const DICTIONARIES: Record<Language, Strings> = { en, ru }
const STORAGE_KEY = 'wayfold.language'

let language: Language = LANGUAGES.find((l) => l === readStored(STORAGE_KEY)) ?? 'en'
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
  store(STORAGE_KEY, next)
  for (const listener of listeners) listener()
}

// Returns a function that stops listening
export function onLanguageChange(listener: () => void): () => void {
  listeners.push(listener)
  return () => listeners.splice(listeners.indexOf(listener), 1)
}
