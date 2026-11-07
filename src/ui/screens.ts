import { onLanguageChange, t } from '../i18n'
import type { MapSettings } from '../sim/mapgen'
import { MAP_SIZES, MAP_TYPES } from '../sim/world'
import { button, element } from './dom'
import { formatTime } from './hud'
import { languageSelect } from './languageSelect'

// The map settings as the new map card shows and changes them
export interface MapChoice {
  current(): MapSettings
  change(settings: MapSettings): void
}

// Cards over the board: the menu, the new map card and the end of the match
export class Screens {
  private content: (() => HTMLElement) | null = null
  private onEscape: (() => void) | null = null

  constructor(private readonly root: HTMLElement) {
    onLanguageChange(() => this.refresh())
  }

  get isOpen(): boolean {
    return this.content !== null
  }

  // Without onContinue there is no match to go back to
  menu(onNewMap: () => void, onContinue?: () => void): void {
    this.show(onContinue ?? null, () => {
      const buttons = element('div', 'menu-buttons')
      if (onContinue) buttons.append(button(t().continue, onContinue, 'primary'))
      buttons.append(button(t().newMap, onNewMap, onContinue ? '' : 'primary'))
      return element(
        'div',
        'card menu',
        element('h1', '', t().title),
        element('p', 'tagline', t().tagline),
        buttons,
        languageSelect(),
      )
    })
  }

  newMap(map: MapChoice, onPlay: () => void, onBack: () => void): void {
    this.show(onBack, () =>
      element(
        'div',
        'card',
        element('h2', '', t().newMap),
        ...this.mapChoices(map),
        element('div', 'actions', button(t().play, onPlay, 'primary'), button(t().back, onBack)),
      ),
    )
  }

  end(won: boolean, seconds: number, onNewMap: () => void, onMenu: () => void): void {
    this.show(null, () =>
      element(
        'div',
        `card small ${won ? 'won' : 'lost'}`,
        element('h2', '', won ? t().victory : t().defeat),
        element('p', '', won ? t().victoryText : t().defeatText),
        element('p', 'muted', `${t().matchTime}: ${formatTime(seconds)}`),
        element('div', 'actions centered', button(t().newMap, onNewMap, 'primary'), button(t().toMenu, onMenu)),
      ),
    )
  }

  // Esc on a card works like its way back, if it has one
  escape(): void {
    this.onEscape?.()
  }

  hide(): void {
    this.content = null
    this.onEscape = null
    this.root.hidden = true
    this.root.replaceChildren()
  }

  private show(onEscape: (() => void) | null, content: () => HTMLElement): void {
    this.content = content
    this.onEscape = onEscape
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
