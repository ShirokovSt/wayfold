import { element } from './dom'
import { LANGUAGES, LANGUAGE_NAMES, currentLanguage, setLanguage } from '../i18n'

// A drop-down list, so it stays small however many languages there are
export function languageSelect(): HTMLSelectElement {
  const select = element('select', 'language')
  for (const language of LANGUAGES) {
    const option = element('option', '', LANGUAGE_NAMES[language])
    option.value = language
    option.selected = language === currentLanguage()
    select.append(option)
  }
  select.addEventListener('change', () => {
    const next = LANGUAGES.find((language) => language === select.value)
    if (next) setLanguage(next)
  })
  return select
}
