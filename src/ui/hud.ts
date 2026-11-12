import { sounds } from '../audio/sounds'
import type { Game } from '../game'
import { onLanguageChange, t } from '../i18n'
import { ownerTone } from '../render/palette'
import { landShare } from '../sim/territory'
import { HUMAN, type PlayerId, type Season, type World } from '../sim/world'
import { button, element } from './dom'
import { withHint } from './hint'
import { icon } from './icons'

const SPEEDS = [0.5, 1, 2, 4, 8]
export const PLAY_SPEED_LIMIT = 2 // faster speeds are only for watching a replay
const SEASON_ICONS: Record<Season, string> = { summer: '☀', autumn: '🍂', winter: '❄', spring: '🌱' }

type Stat = 'villages' | 'people' | 'land' | 'gold'
const STATS: Stat[] = ['villages', 'people', 'land', 'gold']
const RIVAL_STATS = ['villages', 'people', 'land'] as const // a rival's gold is none of your business
const MENU_ICON = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="2" rx="1"/><rect x="2" y="7" width="12" height="2" rx="1"/><rect x="2" y="11" width="12" height="2" rx="1"/></svg>'
export const PAUSE_ICON ='<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></svg>'
export const PLAY_ICON = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.5v11l9-5.5z"/></svg>'
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

// One player's numbers in the bar; a rival's block also says when they fell
interface Row {
  player: PlayerId
  block: HTMLElement
  values: Partial<Record<Stat, HTMLElement>>
  note: HTMLElement
}

// The top bar holds only the match: the menu button, your numbers and every rival's, the season, the clock,
// speed and pause; a thin strip along its bottom shares the map's land out in the players' colors
export class Hud {
  private rows: Row[] = []
  private players = 0 // how many players the bar is built for
  private strip = element('div', 'land-strip')
  private stripRows = element('table', '')
  private clock = element('span', 'clock')
  // The season's icon; hovering or clicking it shows the season's rules
  private seasonButton = button('', () => {}, 'season-button')
  private seasonName = element('b', '')
  private seasonHint = element('p', '')
  private season = withHint(this.seasonButton, this.seasonName, this.seasonHint)
  private pauseButton = button('', () => this.actions.togglePause(), 'icon-button')
  // Quiet at once, music included; the volumes are in the menu's settings
  private soundButton = button('', () => sounds.toggle(), 'icon-button')
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
    if (world.players.length !== this.players) this.build()
    for (const { player, block, values, note } of this.rows) {
      const out = world.out.find((entry) => entry.player === player)
      block.classList.toggle('out', out !== undefined)
      if (values.gold) setText(values.gold, String(Math.floor(world.gold[player])))
      setText(values.villages!, String(world.villages.filter((v) => v.owner === player).length))
      setText(values.people!, String(countPeople(world, player)))
      setText(values.land!, `${Math.round(landShare(world, player) * 100)}%`)
      setText(note, out ? `${t().outAt} ${formatTime(out.time)}` : t().rivalHint)
    }
    this.updateStrip(world)
    const season = world.map.season
    setText(this.seasonButton, SEASON_ICONS[season])
    setText(this.seasonName, t().seasons[season])
    setText(this.seasonHint, t().seasonHints[season])
    setText(this.clock, formatTime(world.time))
    // On pause the button shows what it will do: play
    const resumes = this.game.paused && this.game.started
    setIcon(this.pauseButton, resumes ? PLAY_ICON : PAUSE_ICON, resumes ? t().resume : t().pause)
    setIcon(this.soundButton, sounds.muted ? MUTED_ICON : SOUND_ICON, sounds.muted ? t().soundOn : t().soundOff)
    SPEEDS.forEach((speed, i) => {
      this.speedButtons[i].classList.toggle('active', speed === this.game.speed)
      this.speedButtons[i].hidden = speed > PLAY_SPEED_LIMIT && !this.game.watching
    })
  }

  private build(): void {
    const world = this.game.world
    this.players = world.players.length
    const menu = button('', () => this.actions.openMenu(), 'icon-button')
    menu.innerHTML = MENU_ICON
    menu.title = `${t().menu} (Esc)`
    menu.ariaLabel = t().menu
    this.rows = world.players.map((player) => (player === HUMAN ? this.yourRow() : this.rivalRow(player)))
    this.speedButtons = SPEEDS.map((speed) => button(`×${speed}`, () => this.actions.setSpeed(speed)))
    const speeds = element('div', 'speed', ...this.speedButtons)
    speeds.title = t().speed
    this.root.replaceChildren(
      menu,
      ...this.rows.map((row) => row.block),
      element('div', 'when', this.season, this.clock),
      element('div', 'group', speeds, this.pauseButton, this.soundButton),
      this.strip,
    )
    this.update()
  }

  // Your numbers, each with its own explanation
  private yourRow(): Row {
    const values = { villages: element('b', ''), people: element('b', ''), land: element('b', ''), gold: element('b', '') }
    const items = STATS.map((stat) =>
      withHint(element('span', 'stat', icon(stat), values[stat]), element('b', '', t()[stat]), element('p', '', t().statHints[stat])))
    const block = element('div', 'stats', element('span', 'name', t().you), ...items)
    block.style.borderColor = ownerTone(HUMAN).main
    return { player: HUMAN, block, values, note: element('span', '') }
  }

  // A rival is known by their color: the name and what the numbers mean are in the hint
  private rivalRow(player: PlayerId): Row {
    const values = { villages: element('b', ''), people: element('b', ''), land: element('b', '') }
    const chip = element('span', 'stats rival', ...RIVAL_STATS.map((stat) => element('span', 'stat', icon(stat), values[stat])))
    chip.style.borderColor = ownerTone(player).main
    const note = element('p', '')
    return { player, block: withHint(chip, element('b', '', t().players[player]), note), values, note }
  }

  // Each player's share of all the land, and nobody's share in grey at the end
  private updateStrip(world: World): void {
    const shares = world.players.map((player) => ({ player, share: landShare(world, player) }))
    const free = Math.max(0, 1 - shares.reduce((sum, { share }) => sum + share, 0))
    const key = shares.map(({ share }) => share.toFixed(3)).join()
    if (this.strip.dataset.key === key) return
    this.strip.dataset.key = key
    const parts = shares.map(({ player, share }) => {
      const part = element('span', '')
      part.style.width = `${share * 100}%`
      part.style.background = ownerTone(player).main
      return part
    })
    const percent = (share: number) => `${Math.round(share * 100)}%`
    this.stripRows.replaceChildren(
      ...shares.map(({ player, share }) => element('tr', '', element('td', '', t().players[player]), element('td', '', percent(share)))),
      element('tr', '', element('td', '', t().nobodys), element('td', '', percent(free))),
    )
    this.strip.replaceChildren(...parts, element('div', 'hint', element('b', '', t().landHint), this.stripRows))
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
