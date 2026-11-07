import { onLanguageChange, t } from '../i18n'
import { button, element } from './dom'
import { formatTime } from './hud'
import { languageSwitch } from './languageSwitch'

// Cards over the board: the start screen, the pause and the end of the match
export class Screens {
  private content: (() => HTMLElement) | null = null

  constructor(private readonly root: HTMLElement) {
    onLanguageChange(() => this.refresh())
  }

  start(onPlay: () => void): void {
    this.show(() =>
      element(
        'div',
        'card',
        element('h1', '', t().title),
        element('p', 'tagline', t().tagline),
        element('ul', 'rules', ...t().rules.map((rule) => element('li', '', rule))),
        element('div', 'actions', button(t().play, onPlay, 'primary'), languageSwitch()),
      ),
    )
  }

  paused(onResume: () => void): void {
    this.show(() => element('div', 'card small', element('h2', '', t().paused), button(t().resume, onResume, 'primary')))
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
    this.content = null
    this.root.hidden = true
    this.root.replaceChildren()
  }

  private show(content: () => HTMLElement): void {
    this.content = content
    this.refresh()
  }

  // Cards are rebuilt from scratch, e.g. when the language changes
  private refresh(): void {
    if (!this.content) return
    this.root.replaceChildren(this.content())
    this.root.hidden = false
  }
}
