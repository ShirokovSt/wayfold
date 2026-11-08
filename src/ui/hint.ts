import { element } from './dom'

// Wraps an item of the top bar so a small card explains it: on hover, or after a click,
// since touch screens have no hover; a click anywhere else closes it
export function withHint(trigger: HTMLElement, ...hint: (Node | string)[]): HTMLElement {
  const box = element('div', 'hinted', trigger, element('div', 'hint', ...hint))
  trigger.addEventListener('click', () => {
    const wasOpen = box.classList.contains('open')
    closeHints()
    box.classList.toggle('open', !wasOpen)
  })
  return box
}

function closeHints(target?: Node): void {
  for (const box of document.querySelectorAll('.hinted.open')) {
    if (!target || !box.contains(target)) box.classList.remove('open')
  }
}

document.addEventListener('pointerdown', (event) => closeHints(event.target as Node))
