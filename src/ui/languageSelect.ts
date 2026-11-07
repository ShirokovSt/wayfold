import { element } from './dom'
import { LANGUAGES, LANGUAGE_NAMES, currentLanguage, setLanguage, t } from '../i18n'

// A drop-down list, so it stays small however many languages there are
export function languageSelect(): HTMLElement {
  const select = element('select', '')
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
  return element('label', 'language', t().language, select)
}
