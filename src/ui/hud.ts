import logoUrl from '../assets/logo.svg'
import type { Game } from '../game'
import { onLanguageChange, t } from '../i18n'
import { landShare } from '../sim/territory'
import { HUMAN, PLAYERS, type PlayerId, type World } from '../sim/world'
import { button, element } from './dom'
import { languageSwitch } from './languageSwitch'

interface Actions {
  togglePause(): void
  newMap(): void
}

// The top bar: both players' numbers, the match clock and the buttons
export class Hud {
  private values: { player: PlayerId; villages: HTMLElement; people: HTMLElement; land: HTMLElement }[] = []
  private clock = element('span', 'clock')
  private pauseButton = button('', () => this.actions.togglePause())

  constructor(
    private readonly root: HTMLElement,
    private readonly game: Game,
    private readonly actions: Actions,
  ) {
    this.build()
    onLanguageChange(() => this.build())
  }

  update(): void {
    const world = this.game.world
    for (const { player, villages, people, land } of this.values) {
      setText(villages, String(world.villages.filter((v) => v.owner === player).length))
      setText(people, String(countPeople(world, player)))
      setText(land, `${Math.round(landShare(world, player) * 100)}%`)
    }
    setText(this.clock, formatTime(world.time))
    const started = world.time > 0
    setText(this.pauseButton, this.game.paused && started ? t().resume : t().pause)
  }

  private build(): void {
    const logo = element('img', '')
    logo.src = logoUrl
    logo.alt = ''
    this.values = []
    const stats = PLAYERS.map((player) => {
      const value = () => element('b', '')
      const row = { player, villages: value(), people: value(), land: value() }
      this.values.push(row)
      return element(
        'div',
        `stats ${player === HUMAN ? 'you' : 'rival'}`,
        element('span', 'name', player === HUMAN ? t().you : t().rival),
        element('span', 'label', t().villages), row.villages,
        element('span', 'label', t().people), row.people,
        element('span', 'label', t().land), row.land,
      )
    })
    this.root.replaceChildren(
      element('div', 'brand', logo, t().title),
      ...stats,
      this.clock,
      element('div', 'group', this.pauseButton, button(t().newMap, () => this.actions.newMap()), languageSwitch()),
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
