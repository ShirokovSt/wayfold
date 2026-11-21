import { element } from './dom'

// Wraps an item of the top bar so a small card explains it: on hover, or after a click,
// since touch screens have no hover. The same button works with the keyboard.
let nextHintId = 0

export function withHint(trigger: HTMLButtonElement, ...hint: (Node | string)[]): HTMLElement {
  const description = element('div', 'hint', ...hint)
  description.id = `hud-hint-${++nextHintId}`
  trigger.type = 'button'
  trigger.ariaExpanded = 'false'
  trigger.setAttribute('aria-controls', description.id)
  trigger.setAttribute('aria-describedby', description.id)
  trigger.addEventListener('click', () => {
    const wasOpen = trigger.ariaExpanded === 'true'
    closeHints()
    trigger.ariaExpanded = String(!wasOpen)
  })
  trigger.addEventListener('blur', () => { trigger.ariaExpanded = 'false' })
  trigger.addEventListener('keydown', (event) => {
    if (event.code === 'Space') event.stopPropagation() // Space activates the hint, not pause.
    if (event.key === 'Escape' && trigger.ariaExpanded === 'true') {
      trigger.ariaExpanded = 'false'
      event.stopPropagation()
    }
  })
  return element('div', 'hinted', trigger, description)
}

function closeHints(target?: Node): void {
  for (const trigger of document.querySelectorAll<HTMLButtonElement>('.hinted > button[aria-expanded="true"]')) {
    if (!target || !trigger.parentElement?.contains(target)) trigger.ariaExpanded = 'false'
  }
}

document.addEventListener('pointerdown', (event) => closeHints(event.target as Node))
