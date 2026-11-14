import { version } from '../../package.json'
import { music } from '../audio/music'
import { sounds } from '../audio/sounds'
import { currentLanguage, onLanguageChange, t } from '../i18n'
import { DIFFICULTIES } from '../ai/rival'
import type { MatchSettings } from '../game'
import { REPLAY_EXTENSION, canWatch } from '../replays/format'
import {
  REPLAY_LIMITS, type SavedReplay, deleteReplay, droppedBy, replayLimit, savedReplays, setReplayLimit, starReplay,
} from '../replays/library'
import { MAX_RIVALS, TICK_SECONDS } from '../sim/rules'
import { standings } from '../sim/tick'
import { BEASTS, HUMAN, MAP_SIZES, MAP_TYPES, SEASONS, type World } from '../sim/world'
import { ownerTone } from '../render/palette'
import { button, element } from './dom'
import { formatTime } from './hud'
import { languageSelect } from './languageSelect'

// The settings as the new map card shows and changes them
export interface MatchChoice {
  current(): MatchSettings
  change(settings: MatchSettings): void
}

type Help = 'season' | 'beasts' | 'rivals'

// Actions that would delete replays, so they are confirmed first
type Pending = { kind: 'delete' | 'unstar'; id: string } | { kind: 'limit'; limit: number }

export interface ReplayActions {
  watch(saved: SavedReplay): void
  download(saved: SavedReplay): void
  open(file: File): void
  back(): void
}

export interface MenuActions {
  newMap(): void
  tutorial(): void
  replays(): void
  settings(): void
  continue?: () => void // only while a match is on
  tutorialFirst: boolean // offered first until it has been played once
}

// Cards over the board: the menu, the new map card and the end of the match
export class Screens {
  private content: (() => HTMLElement) | null = null
  private helpOpen: Help | null = null
  private onEscape: (() => void) | null = null
  private pending: Pending | null = null // an action on the replays that waits for Confirm or Cancel

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
      buttons.push(button(t().replays, actions.replays), button(t().settings, actions.settings))
      buttons[0].classList.add('primary')
      return element(
        'div',
        'card menu',
        element('h1', '', t().title),
        element('p', 'tagline', t().tagline),
        element('div', 'menu-buttons', ...buttons),
        element('p', 'credits', `v${version} · © 2026 Stanislav Shirokov`),
      )
    })
  }

  // The music, the game's sounds and the language
  settings(onBack: () => void): void {
    this.show(onBack, () =>
      element(
        'div',
        'card settings',
        element('h2', '', t().settings),
        element(
          'div',
          'choices',
          settingRow(t().music, volumeSlider(music.volume, (volume) => music.setVolume(volume))),
          settingRow(t().effects, volumeSlider(sounds.volume, (volume) => sounds.setVolume(volume), () => sounds.preview())),
          settingRow(t().language, languageSelect()),
        ),
        element('div', 'actions', button(t().back, onBack)),
      ),
    )
  }

  newMap(choice: MatchChoice, onPlay: () => void, onBack: () => void): void {
    this.show(onBack, () =>
      element(
        'div',
        'card',
        element('h2', '', t().newMap),
        this.choices(choice),
        element('div', 'actions', button(t().play, onPlay, 'primary'), button(t().back, onBack)),
      ),
    )
  }

  end(world: World, onNewMap: () => void, onMenu: () => void, onWatch: () => void): void {
    const won = world.winner === HUMAN
    this.show(null, () =>
      element(
        'div',
        `card small ${won ? 'won' : 'lost'}`,
        element('h2', '', won ? t().victory : t().defeat),
        element('p', '', won ? t().victoryText : t().defeatText),
        places(world),
        element('p', 'muted', `${t().matchTime}: ${formatTime(world.time)}`),
        element(
          'div',
          'actions centered',
          button(t().newMap, onNewMap, 'primary'),
          button(t().watchReplay, onWatch),
          button(t().toMenu, onMenu),
        ),
      ),
    )
  }

  // The kept replays, newest first, and how many of them to keep; a file can be opened too.
  // The notice tells what went wrong, e.g. with an opened file
  replays(actions: ReplayActions, notice: string | null = null): void {
    this.pending = null
    this.show(actions.back, () => {
      const list = savedReplays()
      const pending = this.pending
      // A lower limit that would delete replays asks first
      const limit = choiceRow(t().keepReplays, REPLAY_LIMITS.map((count) =>
        [String(count), replayLimit() === count, () => this.ask({ kind: 'limit', limit: count }, droppedBy(count).length > 0,
          () => setReplayLimit(count))]))
      const dropping = pending?.kind === 'limit' ? droppedBy(pending.limit) : []
      const limitQuestion = pending?.kind === 'limit'
        ? [this.confirmBar(t().limitDrops(pending.limit, dropping.length), () => setReplayLimit(pending.limit))]
        : []
      const file = element('input', '')
      file.type = 'file'
      file.accept = REPLAY_EXTENSION
      file.hidden = true
      file.addEventListener('change', () => file.files?.[0] && actions.open(file.files[0]))
      return element(
        'div',
        'card replays',
        element('h2', '', t().replays),
        element('div', 'choices', limit),
        ...limitQuestion,
        list.length > 0
          ? element('div', 'replay-list', ...list.map((saved) => this.replayRow(saved, actions, dropping.includes(saved.id))))
          : element('p', 'muted', t().noReplays),
        ...(notice ? [element('p', 'notice', notice)] : []),
        element('div', 'actions', button(t().openFile, () => file.click()), button(t().back, actions.back)),
        file,
      )
    })
  }

  // The result and the map, when and how long; a star keeps it for good. Deleting asks first,
  // and so does taking off a star when that leaves the replay beyond the limit
  private replayRow(saved: SavedReplay, actions: ReplayActions, dropping: boolean): HTMLElement {
    const info = saved.info
    const id = saved.id
    const unstarDrops = saved.starred && droppedBy(replayLimit(), id).includes(id)
    const star = button(saved.starred ? '★' : '☆', () =>
      this.ask({ kind: 'unstar', id }, unstarDrops, () => starReplay(id, !saved.starred)), `star${saved.starred ? ' active' : ''}`)
    star.title = saved.starred ? t().unstarReplay : t().starReplay
    const won = info.place === 1
    const map = [t().mapTypes[info.mapType], t().mapSizes[info.size], t().seasons[info.season],
      t().rivalCount(info.players - 1), t().difficulties[info.difficulty]].join(' · ')
    const when = `${formatDate(info.savedAt)} · ${formatTime(info.ticks * TICK_SECONDS)}`
    const watch = button(t().watch, () => actions.watch(saved), 'primary')
    watch.disabled = !canWatch(info)
    const remove = button(t().deleteReplay, () => this.ask({ kind: 'delete', id }, true, () => deleteReplay(id)))
    const pending = this.pending
    const question = pending?.kind === 'delete' && pending.id === id ? t().deleteSure
      : pending?.kind === 'unstar' && pending.id === id ? t().unstarDrops(replayLimit())
      : null
    const notes = [
      ...(canWatch(info) ? [] : [element('p', 'notice', t().otherVersion(info.version))]),
      ...(dropping ? [element('p', 'notice', t().willBeDeleted)] : []),
    ]
    return element(
      'div',
      `replay-row${dropping ? ' dropping' : ''}`,
      star,
      element(
        'div',
        'replay-text',
        element('p', '', element('b', won ? 'won' : 'lost', won ? t().victory : t().defeat), ` · ${t().place(info.place, info.players)}`),
        element('p', 'muted', map),
        element('p', 'muted', when),
        ...notes,
      ),
      element('div', 'replay-buttons', watch, button(t().download, () => actions.download(saved)), remove),
      ...(question ? [this.confirmBar(question, () => (pending!.kind === 'delete' ? deleteReplay(id) : starReplay(id, false)))] : []),
    )
  }

  // Does the action at once, or when it would delete something, first asks with a confirm bar
  private ask(action: Pending, risky: boolean, act: () => void): void {
    this.pending = null
    if (risky) this.pending = action
    else act()
    this.refresh()
  }

  // A question with Confirm and Cancel under it
  private confirmBar(question: string, onConfirm: () => void): HTMLElement {
    const close = () => {
      this.pending = null
      this.refresh()
    }
    return element(
      'div',
      'confirm-bar',
      element('p', 'notice', question),
      element('div', 'confirm-buttons', button(t().confirm, () => {
        onConfirm()
        close()
      }, 'danger'), button(t().cancel, close)),
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
  private choices(choice: MatchChoice): HTMLElement {
    const settings = choice.current()
    const choose = (next: MatchSettings) => {
      choice.change(next)
      this.refresh()
    }
    // The rules of seasons and of wolves open under their row from a "?", so the card stays light
    const help = (topic: Help, title: string) => {
      const node = button('?', () => {
        this.helpOpen = this.helpOpen === topic ? null : topic
        this.refresh()
      }, `help${this.helpOpen === topic ? ' active' : ''}`)
      node.title = title
      return node
    }
    const seasonRules = element('div', 'season-rules',
      ...SEASONS.map((season) => element('p', '', element('b', '', t().seasons[season]), ` — ${t().seasonHints[season]}`)))
    const beastRules = element('div', 'season-rules', ...t().beastHints.map((hint) => element('p', '', hint)))
    const rivalRules = element('div', 'season-rules', ...t().rivalHints.map((hint) => element('p', '', hint)))
    // A smaller map takes fewer rivals: the extra ones are greyed out, and the count shrinks to fit
    const rivals = [1, 2, 3].map((count) => {
      const node = button(String(count), () => choose({ ...settings, rivals: count }))
      node.classList.toggle('active', settings.rivals === count)
      node.disabled = count > MAX_RIVALS[settings.size]
      return node
    })
    return element(
      'div',
      'choices',
      choiceRow(t().mapType, (['random', ...MAP_TYPES] as const).map((type) =>
        [t().mapTypes[type], settings.type === type, () => choose({ ...settings, type })])),
      choiceRow(t().mapSize, MAP_SIZES.map((size) =>
        [t().mapSizes[size], settings.size === size, () =>
          choose({ ...settings, size, rivals: Math.min(settings.rivals, MAX_RIVALS[size]) })])),
      element('div', 'choice', element('span', 'label', t().rivals, help('rivals', t().rivalRules)), element('div', 'options', ...rivals)),
      ...(this.helpOpen === 'rivals' ? [rivalRules] : []),
      choiceRow([t().season, help('season', t().seasonRules)], (['random', ...SEASONS] as const).map((season) =>
        [t().seasons[season], settings.season === season, () => choose({ ...settings, season })])),
      ...(this.helpOpen === 'season' ? [seasonRules] : []),
      choiceRow([t().beasts, help('beasts', t().beastRules)], BEASTS.map((beasts) =>
        [t().beastLevels[beasts], settings.beasts === beasts, () => choose({ ...settings, beasts })])),
      ...(this.helpOpen === 'beasts' ? [beastRules] : []),
      choiceRow(t().difficulty, DIFFICULTIES.map((difficulty) =>
        [t().difficulties[difficulty], settings.difficulty === difficulty, () => choose({ ...settings, difficulty })])),
    )
  }

  // Cards are rebuilt from scratch, e.g. when the language changes
  private refresh(): void {
    if (!this.content) return
    this.root.replaceChildren(this.content())
    this.root.hidden = false
  }
}

// The day and the time, as is usual in the language: "14 Nov, 15:30"
function formatDate(time: number): string {
  return new Date(time).toLocaleString(currentLanguage(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function settingRow(label: string, control: HTMLElement): HTMLElement {
  return element('label', 'choice', element('span', 'label', label), element('div', 'options', control))
}

// From 0 to 100; letting go can play something, to hear the new volume
function volumeSlider(value: number, onChange: (volume: number) => void, onRelease?: () => void): HTMLInputElement {
  const slider = element('input', 'volume')
  slider.type = 'range'
  slider.min = '0'
  slider.max = '100'
  slider.value = String(Math.round(value * 100))
  slider.addEventListener('input', () => onChange(Number(slider.value) / 100))
  if (onRelease) slider.addEventListener('change', onRelease)
  return slider
}

// Everyone in order of their place: the winner, those still standing, then the fallen, the last to fall first
function places(world: World): HTMLElement {
  const rows = standings(world).map((player, i) => {
    const out = world.out.find((entry) => entry.player === player)
    const result = i === 0 ? t().won : out ? `${t().outAt} ${formatTime(out.time)}` : t().standing
    const dot = element('span', 'dot')
    dot.style.background = ownerTone(player).main
    return element('tr', player === HUMAN ? 'me' : '',
      element('td', '', `${i + 1}.`), element('td', '', dot, t().players[player]), element('td', 'muted', result))
  })
  return element('table', 'places', ...rows)
}

// A label and a row of buttons, one of them pressed
function choiceRow(label: string | (Node | string)[], options: [string, boolean, () => void][]): HTMLElement {
  const buttons = options.map(([text, active, onClick]) => {
    const node = button(text, onClick)
    node.classList.toggle('active', active)
    return node
  })
  const labelParts = typeof label === 'string' ? [label] : label
  return element('div', 'choice', element('span', 'label', ...labelParts), element('div', 'options', ...buttons))
}
