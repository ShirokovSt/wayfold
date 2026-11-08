import logoUrl from '../assets/logo.svg'
import type { Game } from '../game'
import { onLanguageChange, t } from '../i18n'
import { landShare } from '../sim/territory'
import { HUMAN, PLAYERS, type PlayerId, type Season, type World } from '../sim/world'
import { button, element } from './dom'

const SPEEDS = [0.5, 1, 2]
const SEASON_ICONS: Record<Season, string> = { summer: '☀', autumn: '🍂', winter: '❄', spring: '🌱' }

interface Actions {
  togglePause(): void
  openMenu(): void
  setSpeed(speed: number): void
}

// The top bar holds only the match: the menu button, both players' numbers, the season, the clock, speed and pause
export class Hud {
  private values: { player: PlayerId; villages: HTMLElement; people: HTMLElement; land: HTMLElement; gold: HTMLElement }[] = []
  private clock = element('span', 'clock')
  // The season's icon; hovering or clicking it shows the season's rules
  private seasonButton = button('', () => this.season.classList.toggle('open'), 'season-button')
  private seasonName = element('b', '')
  private seasonHint = element('p', '')
  private season = element('div', 'season', this.seasonButton, element('div', 'season-info', this.seasonName, this.seasonHint))
  private pauseButton = button('', () => this.actions.togglePause())
  private speedButtons: HTMLButtonElement[] = []

  constructor(
    private readonly root: HTMLElement,
    private readonly game: Game,
    private readonly actions: Actions,
  ) {
    this.build()
    onLanguageChange(() => this.build())
    document.addEventListener('pointerdown', (event) => {
      if (!this.season.contains(event.target as Node)) this.season.classList.remove('open')
    })
  }

  update(): void {
    const world = this.game.world
    for (const { player, villages, people, land, gold } of this.values) {
      setText(gold, String(Math.floor(world.gold[player])))
      setText(villages, String(world.villages.filter((v) => v.owner === player).length))
      setText(people, String(countPeople(world, player)))
      setText(land, `${Math.round(landShare(world, player) * 100)}%`)
    }
    const season = world.map.season
    setText(this.seasonButton, SEASON_ICONS[season])
    setText(this.seasonName, t().seasons[season])
    setText(this.seasonHint, t().seasonHints[season])
    setText(this.clock, formatTime(world.time))
    setText(this.pauseButton, this.game.paused && this.game.started ? t().resume : t().pause)
    SPEEDS.forEach((speed, i) => this.speedButtons[i].classList.toggle('active', speed === this.game.speed))
  }

  private build(): void {
    const logo = element('img', '')
    logo.src = logoUrl
    logo.alt = ''
    const menu = button(t().menu, () => this.actions.openMenu(), 'menu-button')
    menu.prepend(logo)
    menu.title = `${t().menu} (Esc)`
    this.values = []
    const stats = PLAYERS.map((player) => {
      const value = () => element('b', '')
      const row = { player, villages: value(), people: value(), land: value(), gold: value() }
      this.values.push(row)
      return element(
        'div',
        `stats ${player === HUMAN ? 'you' : 'rival'}`,
        element('span', 'name', player === HUMAN ? t().you : t().rival),
        element('span', 'label', t().villages), row.villages,
        element('span', 'label', t().people), row.people,
        element('span', 'label', t().land), row.land,
        element('span', 'label', t().gold), row.gold,
      )
    })
    this.speedButtons = SPEEDS.map((speed) => button(`×${speed}`, () => this.actions.setSpeed(speed)))
    const speeds = element('div', 'speed', ...this.speedButtons)
    speeds.title = t().speed
    this.root.replaceChildren(
      menu,
      ...stats,
      element('div', 'when', this.season, this.clock),
      element('div', 'group', speeds, this.pauseButton),
    )
    this.update()
  }
}

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// People in villages and on the march
function countPeople(world: World, player: PlayerId): number {
  let count = 0
  for (const village of world.villages) if (village.owner === player) count += Math.floor(village.population)
  for (const squad of world.squads) if (squad.owner === player) count += squad.count
  return count
}

// Touch the page only when the text really changes: this runs every frame
function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text
}
