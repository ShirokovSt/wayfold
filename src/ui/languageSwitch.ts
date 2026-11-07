import { button, element } from './dom'
import { LANGUAGES, currentLanguage, setLanguage, t } from '../i18n'

// EN / RU buttons; the screens rebuild themselves when the language changes
export function languageSwitch(): HTMLElement {
  const group = element('div', 'group language')
  group.title = t().language
  for (const language of LANGUAGES) {
    const languageButton = button(language.toUpperCase(), () => setLanguage(language))
    languageButton.classList.toggle('active', language === currentLanguage())
    group.append(languageButton)
  }
  return group
}
