import { version } from '../../package.json'
import { onLanguageChange, t } from '../i18n'
import { DIFFICULTIES } from '../ai/rival'
import type { MatchSettings } from '../game'
import { MAP_SIZES, MAP_TYPES, SEASONS } from '../sim/world'
import { button, element } from './dom'
import { formatTime } from './hud'
import { languageSelect } from './languageSelect'

// The settings as the new map card shows and changes them
export interface MatchChoice {
  current(): MatchSettings
  change(settings: MatchSettings): void
}

export interface MenuActions {
  newMap(): void
  tutorial(): void
  continue?: () => void // only while a match is on
  tutorialFirst: boolean // offered first until it has been played once
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

  // The first button is the main one: Continue during a match, otherwise the tutorial or a new map
  menu(actions: MenuActions): void {
    this.show(actions.continue ?? null, () => {
      const buttons = [button(t().newMap, actions.newMap), button(t().tutorial, actions.tutorial)]
      if (actions.tutorialFirst) buttons.reverse()
      if (actions.continue) buttons.unshift(button(t().continue, actions.continue))
      buttons[0].classList.add('primary')
      return element(
        'div',
        'card menu',
        element('h1', '', t().title),
        element('p', 'tagline', t().tagline),
        element('div', 'menu-buttons', ...buttons),
        languageSelect(),
        element('p', 'credits', `v${version} · © 2026 Stanislav Shirokov`),
      )
    })
  }

  newMap(choice: MatchChoice, onPlay: () => void, onBack: () => void): void {
    this.show(onBack, () =>
      element(
        'div',
        'card',
        element('h2', '', t().newMap),
        ...this.choices(choice),
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

  tutorialDone(onNewMap: () => void, onMenu: () => void): void {
    this.show(null, () =>
      element(
        'div',
        'card small won',
        element('h2', '', t().tutorialDone),
        element('p', '', t().tutorialDoneText),
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

  // Map type, size, season and difficulty rows; a click changes the setting and redraws the card
  private choices(choice: MatchChoice): HTMLElement[] {
    const settings = choice.current()
    const choose = (next: MatchSettings) => {
      choice.change(next)
      this.refresh()
    }
    return [
      choiceRow(t().mapType, (['random', ...MAP_TYPES] as const).map((type) =>
        [t().mapTypes[type], settings.type === type, () => choose({ ...settings, type })])),
      choiceRow(t().mapSize, MAP_SIZES.map((size) =>
        [t().mapSizes[size], settings.size === size, () => choose({ ...settings, size })])),
      choiceRow(t().season, (['random', ...SEASONS] as const).map((season) =>
        [t().seasons[season], settings.season === season, () => choose({ ...settings, season })])),
      element('p', 'season-hint', t().seasonHints[settings.season]),
      choiceRow(t().difficulty, DIFFICULTIES.map((difficulty) =>
        [t().difficulties[difficulty], settings.difficulty === difficulty, () => choose({ ...settings, difficulty })])),
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
