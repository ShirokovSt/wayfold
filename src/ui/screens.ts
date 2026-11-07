import { onLanguageChange, t } from '../i18n'
import type { MapSettings } from '../sim/mapgen'
import { MAP_SIZES, MAP_TYPES } from '../sim/world'
import { button, element } from './dom'
import { formatTime } from './hud'
import { languageSwitch } from './languageSwitch'

// The map settings as the start screen shows and changes them
export interface MapChoice {
  current(): MapSettings
  change(settings: MapSettings): void
}

// Cards over the board: the start screen and the end of the match
export class Screens {
  choosingMap = false // the new map card is open: the game behind it must not be resumed
  private content: (() => HTMLElement) | null = null

  constructor(private readonly root: HTMLElement) {
    onLanguageChange(() => this.refresh())
  }

  start(onPlay: () => void, map: MapChoice): void {
    this.show(() =>
      element(
        'div',
        'card',
        element('h1', '', t().title),
        element('p', 'tagline', t().tagline),
        element('ul', 'rules', ...t().rules.map((rule) => element('li', '', rule))),
        ...this.mapChoices(map),
        element('div', 'actions', button(t().play, onPlay, 'primary'), languageSwitch()),
      ),
    )
  }

  // Picking the next map; without onCancel there is no match to go back to
  newMap(map: MapChoice, onPlay: () => void, onCancel?: () => void): void {
    this.choosingMap = true
    this.show(() => {
      const actions = element('div', 'actions', button(t().play, onPlay, 'primary'))
      if (onCancel) actions.append(button(t().cancel, onCancel))
      return element('div', 'card', element('h2', '', t().newMap), ...this.mapChoices(map), actions)
    })
  }

  end(won: boolean, seconds: number, onPlayAgain: () => void): void {
    this.show(() =>
      element(
        'div',
        `card small ${won ? 'won' : 'lost'}`,
        element('h2', '', won ? t().victory : t().defeat),
        element('p', '', won ? t().victoryText : t().defeatText),
        element('p', 'muted', `${t().matchTime}: ${formatTime(seconds)}`),
        button(t().playAgain, onPlayAgain, 'primary'),
      ),
    )
  }

  hide(): void {
    this.choosingMap = false
    this.content = null
    this.root.hidden = true
    this.root.replaceChildren()
  }

  private show(content: () => HTMLElement): void {
    this.content = content
    this.refresh()
  }

  // Map type and size rows; a click changes the setting and redraws the card
  private mapChoices(map: MapChoice): HTMLElement[] {
    const settings = map.current()
    const choose = (next: MapSettings) => {
      map.change(next)
      this.refresh()
    }
    return [
      choiceRow(t().mapType, (['random', ...MAP_TYPES] as const).map((type) =>
        [t().mapTypes[type], settings.type === type, () => choose({ ...settings, type })])),
      choiceRow(t().mapSize, MAP_SIZES.map((size) =>
        [t().mapSizes[size], settings.size === size, () => choose({ ...settings, size })])),
    ]
  }

  // Cards are rebuilt from scratch, e.g. when the language changes
  private refresh(): void {
    if (!this.content) return
    this.root.replaceChildren(this.content())
    this.root.hidden = false
  }
}

// A label and a row of buttons, one of them pressed
function choiceRow(label: string, options: [string, boolean, () => void][]): HTMLElement {
  const buttons = options.map(([text, active, onClick]) => {
    const node = button(text, onClick)
    node.classList.toggle('active', active)
    return node
  })
  return element('div', 'choice', element('span', 'label', label), element('div', 'options', ...buttons))
}
