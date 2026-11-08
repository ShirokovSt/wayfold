import { sounds } from '../audio/sounds'
import type { Game } from '../game'
import { onLanguageChange, t } from '../i18n'
import { landShare } from '../sim/territory'
import { HUMAN, PLAYERS, type PlayerId, type Season, type World } from '../sim/world'
import { button, element } from './dom'
import { withHint } from './hint'

const SPEEDS = [0.5, 1, 2]
const SEASON_ICONS: Record<Season, string> = { summer: '☀', autumn: '🍂', winter: '❄', spring: '🌱' }

type Stat = 'villages' | 'people' | 'land' | 'gold'
const STATS: Stat[] = ['villages', 'people', 'land', 'gold']
// Little pictures instead of words: a house, a person, a tile and a coin
const ICONS: Record<Stat, string> = {
  villages: '<path d="M2 8 8 2.5 14 8v6H2z"/>',
  people: '<circle cx="8" cy="4.6" r="2.7"/><path d="M3 14c0-4.4 2.2-6 5-6s5 1.6 5 6z"/>',
  land: '<path d="M8 1.5l5.6 3.25v6.5L8 14.5l-5.6-3.25v-6.5z"/>',
  gold: '<circle cx="8" cy="8" r="5.6" fill="#f2c14e" stroke="#8a6514" stroke-width="1.5"/>',
}
const MENU_ICON = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="2" rx="1"/><rect x="2" y="7" width="12" height="2" rx="1"/><rect x="2" y="11" width="12" height="2" rx="1"/></svg>'
const PAUSE_ICON ='<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></svg>'
const PLAY_ICON = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.5v11l9-5.5z"/></svg>'
// A speaker with sound waves, or crossed out when muted
const SPEAKER = '<path d="M1.5 6h3l4-3.5v11l-4-3.5h-3z"/>'
const LINE = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"'
const SOUND_ICON = `<svg viewBox="0 0 16 16" fill="currentColor">${SPEAKER}<path ${LINE} d="M10.8 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6.3 6.3 0 0 1 0 9"/></svg>`
const MUTED_ICON = `<svg viewBox="0 0 16 16" fill="currentColor">${SPEAKER}<path ${LINE} d="M11 6l4 4M15 6l-4 4"/></svg>`

interface Actions {
  togglePause(): void
  openMenu(): void
  setSpeed(speed: number): void
}

// The top bar holds only the match: the menu button, both players' numbers, the season, the clock, speed and pause
export class Hud {
  private values: { player: PlayerId; values: Record<Stat, HTMLElement> }[] = []
  private clock = element('span', 'clock')
  // The season's icon; hovering or clicking it shows the season's rules
  private seasonButton = button('', () => {}, 'season-button')
  private seasonName = element('b', '')
  private seasonHint = element('p', '')
  private season = withHint(this.seasonButton, this.seasonName, this.seasonHint)
  private pauseButton = button('', () => this.actions.togglePause(), 'icon-button')
  private soundButton = button('', () => sounds.toggle(), 'icon-button')
  private volume = volumeSlider()
  private speedButtons: HTMLButtonElement[] = []

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
    for (const { player, values } of this.values) {
      setText(values.gold, String(Math.floor(world.gold[player])))
      setText(values.villages, String(world.villages.filter((v) => v.owner === player).length))
      setText(values.people, String(countPeople(world, player)))
      setText(values.land, `${Math.round(landShare(world, player) * 100)}%`)
    }
    const season = world.map.season
    setText(this.seasonButton, SEASON_ICONS[season])
    setText(this.seasonName, t().seasons[season])
    setText(this.seasonHint, t().seasonHints[season])
    setText(this.clock, formatTime(world.time))
    // On pause the button shows what it will do: play
    const resumes = this.game.paused && this.game.started
    setIcon(this.pauseButton, resumes ? PLAY_ICON : PAUSE_ICON, resumes ? t().resume : t().pause)
    setIcon(this.soundButton, sounds.silent ? MUTED_ICON : SOUND_ICON, sounds.silent ? t().soundOn : t().soundOff)
    const volume = String(Math.round(sounds.volume * 100))
    if (this.volume.value !== volume) this.volume.value = volume
    this.volume.classList.toggle('off', sounds.silent)
    SPEEDS.forEach((speed, i) => this.speedButtons[i].classList.toggle('active', speed === this.game.speed))
  }

  private build(): void {
    const menu = button('', () => this.actions.openMenu(), 'icon-button')
    menu.innerHTML = MENU_ICON
    menu.title = `${t().menu} (Esc)`
    menu.ariaLabel = t().menu
    this.values = []
    const stats = PLAYERS.map((player) => {
      const values = { villages: element('b', ''), people: element('b', ''), land: element('b', ''), gold: element('b', '') }
      this.values.push({ player, values })
      const items = STATS.map((stat) =>
        withHint(element('span', 'stat', icon(stat), values[stat]), element('b', '', t()[stat]), element('p', '', t().statHints[stat])))
      return element('div', `stats ${player === HUMAN ? 'you' : 'rival'}`, element('span', 'name', player === HUMAN ? t().you : t().rival), ...items)
    })
    this.speedButtons = SPEEDS.map((speed) => button(`×${speed}`, () => this.actions.setSpeed(speed)))
    const speeds = element('div', 'speed', ...this.speedButtons)
    speeds.title = t().speed
    this.volume.title = t().volume
    this.volume.ariaLabel = t().volume
    this.root.replaceChildren(
      menu,
      ...stats,
      element('div', 'when', this.season, this.clock),
      element('div', 'group', speeds, this.pauseButton, element('div', 'sound', this.soundButton, this.volume)),
    )
    this.update()
  }
}

function icon(stat: Stat): HTMLElement {
  const node = element('span', 'stat-icon')
  node.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor">${ICONS[stat]}</svg>`
  return node
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

// On release it pings, to hear the new volume, and gives the arrow keys back to the map
function volumeSlider(): HTMLInputElement {
  const slider = element('input', 'volume')
  slider.type = 'range'
  slider.min = '0'
  slider.max = '100'
  slider.addEventListener('input', () => sounds.setVolume(Number(slider.value) / 100))
  slider.addEventListener('change', () => {
    slider.blur()
    sounds.preview()
  })
  return slider
}

// The label tells what a click will do; the picture changes along with it
function setIcon(node: HTMLButtonElement, svg: string, label: string): void {
  if (node.title === label) return
  node.title = label
  node.ariaLabel = label
  node.innerHTML = svg
}

// Touch the page only when the text really changes: this runs every frame
function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text
}
