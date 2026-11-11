import type { Game } from '../game'
import { onLanguageChange, t } from '../i18n'
import { TICK_SECONDS } from '../sim/rules'
import { button, element } from './dom'
import { PAUSE_ICON, PLAY_ICON, formatTime } from './hud'

interface Actions {
  togglePause(): void
  seek(ticks: number): void
  exit(): void
}

// Under the board while a replay plays: play and pause, a slider through the whole match, the time, and the way out
export class ReplayBar {
  private readonly root = element('div', 'replay')
  private readonly playButton = button('', () => this.actions.togglePause(), 'icon-button')
  private readonly slider = element('input', 'timeline')
  private readonly time = element('span', 'replay-time')
  private readonly exitButton = button('', () => this.actions.exit())
  private readonly label = element('b', '')
  private playing: boolean | null = null

  constructor(
    stage: HTMLElement,
    private readonly game: Game,
    private readonly actions: Actions,
  ) {
    this.slider.type = 'range'
    this.slider.min = '0'
    this.slider.step = '1'
    this.slider.addEventListener('input', () => this.actions.seek(Number(this.slider.value)))
    this.root.append(this.label, this.playButton, this.slider, this.time, this.exitButton)
    this.root.hidden = true
    stage.append(this.root)
    this.showTexts()
    onLanguageChange(() => this.showTexts())
  }

  // Runs every frame
  update(): void {
    const game = this.game
    this.root.hidden = !game.watching
    if (!game.watching) return
    const length = game.replayLength
    this.slider.max = String(length)
    if (!this.slider.matches(':active')) this.slider.value = String(game.world.ticks) // not under the dragging hand
    const text = `${formatTime(game.world.time)} / ${formatTime(length * TICK_SECONDS)}`
    if (this.time.textContent !== text) this.time.textContent = text
    const playing = !game.paused && game.world.winner === null
    if (playing !== this.playing) {
      this.playing = playing
      this.playButton.innerHTML = playing ? PAUSE_ICON : PLAY_ICON
      this.playButton.title = playing ? t().pause : t().resume
    }
  }

  private showTexts(): void {
    this.label.textContent = t().replay
    this.slider.title = t().replayTime
    this.exitButton.textContent = t().toResults
    this.playing = null // the button's label is redone on the next frame
  }
}
