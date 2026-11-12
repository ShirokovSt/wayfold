import { element } from './dom'

// Little pictures instead of words: a house, a person, a tile, a coin, a sheaf and a tower
const ICONS = {
  villages: '<path d="M2 8 8 2.5 14 8v6H2z"/>',
  people: '<circle cx="8" cy="4.6" r="2.7"/><path d="M3 14c0-4.4 2.2-6 5-6s5 1.6 5 6z"/>',
  land: '<path d="M8 1.5l5.6 3.25v6.5L8 14.5l-5.6-3.25v-6.5z"/>',
  gold: '<circle cx="8" cy="8" r="5.6" fill="#f2c14e" stroke="#8a6514" stroke-width="1.5"/>',
  farm: '<path d="M7.2 15V8.5h1.6V15zM8 1.5c1.6 1.2 1.6 4.8 0 6-1.6-1.2-1.6-4.8 0-6zM3.5 5c2 .2 4 2.2 4.3 4.5C5.6 9.3 3.7 7.3 3.5 5zm9 0c-.2 2.3-2.1 4.3-4.3 4.5.3-2.3 2.3-4.3 4.3-4.5z"/>',
  tower: '<path d="M3.5 1.5h2v2h1.5v-2h2v2h1.5v-2h2v4l-1.3 1.3V14.5H4.8V6.8L3.5 5.5z"/>',
}
export type IconName = keyof typeof ICONS

export function icon(name: IconName): HTMLElement {
  const node = element('span', 'stat-icon')
  node.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor">${ICONS[name]}</svg>`
  return node
}
