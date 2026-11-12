import './ui/styles.css'
import logoUrl from './assets/logo.svg'
import { EventWatcher } from './audio/events'
import { music } from './audio/music'
import { sounds } from './audio/sounds'
import { Game } from './game'
import { currentLanguage, onLanguageChange, t } from './i18n'
import { CameraControls } from './input/camera'
import { PointerInput } from './input/pointer'
import { Renderer } from './render/renderer'
import { TICK_SECONDS } from './sim/rules'
import type { Cell } from './sim/world'
import { readStored, store } from './storage'
import { Hud, PLAY_SPEED_LIMIT } from './ui/hud'
import { ReplayBar } from './ui/replayBar'
import { Screens } from './ui/screens'
import { TileCard } from './ui/tileCard'
import { TutorialPanel } from './ui/tutorialPanel'
import { zoomButtons } from './ui/zoomButtons'

const TICK_MS = TICK_SECONDS * 1000
const MAX_FRAME_MS = 250 // after a long pause, don't try to catch up
const TUTORIAL_KEY = 'wayfold.tutorial' // set once the tutorial has been started

const favicon = document.createElement('link')
favicon.rel = 'icon'
favicon.href = logoUrl
document.head.append(favicon)
document.documentElement.lang = currentLanguage()

const game = new Game(Date.now())
const canvas = document.querySelector<HTMLCanvasElement>('#board')!
const renderer = new Renderer(canvas, game.world)
const input = new PointerInput(canvas, renderer.layout, game)
const screens = new Screens(document.querySelector('#overlay')!)
const hud = new Hud(document.querySelector('#hud')!, game, { togglePause, openMenu, setSpeed })
const stage = document.querySelector<HTMLElement>('.stage')!
const card = new TileCard(stage, game, renderer.layout)
const camera = new CameraControls(canvas, renderer.layout)
const banner = document.querySelector<HTMLElement>('#banner')!
const tutorial = new TutorialPanel(stage, skipTutorial)
const replayBar = new ReplayBar(stage, game, { togglePause, seek, exit: stopWatching })
const events = new EventWatcher()
let endShown = false
let pausedBeforeMenu = false

// Any press closes the card; a click on another tile opens that one's, a click on the same tile leaves it closed
let closedCell: Cell | null = null
input.onPress = () => {
  closedCell = card.cell
  card.close()
}
input.onTileClick = (cell) => {
  if (cell !== closedCell) card.open(cell)
}
input.onCameraMove = () => renderer.cameraMoved()
camera.onChange = () => renderer.cameraMoved()
zoomButtons(stage, camera)

function play(): void {
  game.started = true
  game.paused = false
  banner.hidden = true
  screens.hide()
}

// The pause leaves the board open: you can still give orders, they start when the game resumes
function togglePause(): void {
  if (screens.isOpen) return
  if (game.watching) {
    const ended = game.world.winner !== null
    if (ended) seek(0) // the replay is over: play it from the start again
    game.paused = !ended && !game.paused
    return
  }
  if (game.world.winner !== null) return
  if (game.paused) {
    play()
  } else {
    game.paused = true
    banner.hidden = false
  }
}

function setSpeed(speed: number): void {
  game.speed = speed
}

// The menu holds the match on a real pause: no orders behind it. Continue goes back to it as it was
function openMenu(): void {
  if (!screens.isOpen) {
    pausedBeforeMenu = game.paused
    game.paused = true
    banner.hidden = true
    input.drag = null
    input.hover = null
    card.close()
  }
  if (!inMatch()) music.play('menu')
  screens.menu({
    newMap: chooseNewMap,
    tutorial: startTutorial,
    settings: () => screens.settings(openMenu),
    continue: inMatch() ? continueMatch : undefined,
    tutorialFirst: readStored(TUTORIAL_KEY) === null,
  })
}

// A match being played or watched: the menu over it keeps the season's music
function inMatch(): boolean {
  return game.started && (game.watching || game.world.winner === null)
}

function continueMatch(): void {
  screens.hide()
  game.paused = pausedBeforeMenu
  banner.hidden = !pausedBeforeMenu
}

// The settings change only when Play is pressed; Back leaves them as they were
function chooseNewMap(): void {
  if (!inMatch()) music.play('menu') // e.g. straight from the victory card
  let settings = game.settings
  const choice = { current: () => settings, change: (next: typeof settings) => (settings = next) }
  const start = () => {
    game.changeSettings(settings)
    newMap()
  }
  screens.newMap(choice, start, openMenu)
}

function newMap(): void {
  game.restart(Date.now())
  tutorial.stop()
  startMatch()
}

function startTutorial(): void {
  game.startTutorial()
  store(TUTORIAL_KEY, 'started')
  tutorial.start()
  startMatch()
}

// Leaves the tutorial for the menu, with a fresh map behind it
function skipTutorial(): void {
  tutorial.stop()
  game.restart(Date.now())
  renderer.setWorld(game.world)
  openMenu()
}

function startMatch(): void {
  music.play(game.world.map.season)
  renderer.setWorld(game.world)
  input.drag = null
  card.close()
  endShown = false
  playSpeed()
  play()
}

// The finished match from the start, at any speed; the board can be moved and zoomed, but not ordered
function watchReplay(): void {
  card.close() // its tile is in the world being left
  game.watch()
  renderer.showWorld(game.world)
  music.play(game.world.map.season)
  play()
}

function seek(ticks: number): void {
  card.close()
  game.watch(ticks)
  renderer.showWorld(game.world)
}

function stopWatching(): void {
  card.close()
  game.stopWatching()
  renderer.showWorld(game.world)
  playSpeed()
  showEnd()
}

// The fastest speeds are only for replays
function playSpeed(): void {
  if (game.speed > PLAY_SPEED_LIMIT) game.speed = 1
}

function showEnd(): void {
  screens.end(game.world, chooseNewMap, openMenu, watchReplay)
}

const showTexts = () => (banner.textContent = t().pausedHint)
showTexts()
onLanguageChange(showTexts)

new ResizeObserver(() => renderer.resize()).observe(canvas)
// Esc first cancels what is in hand, then opens the menu; on a card it goes back
window.addEventListener('keydown', (event) => {
  if (screens.isOpen) {
    if (event.key === 'Escape') screens.escape()
    return
  }
  if (event.key === 'Escape') {
    if (input.drag) input.drag = null
    else if (card.cell) card.close()
    else if (game.watching) stopWatching()
    else openMenu()
  } else if (event.code === 'Space') {
    event.preventDefault() // otherwise Space would also press the focused button
    togglePause()
  } else if (event.code === 'KeyM') {
    sounds.toggle()
  } else {
    camera.key(event)
  }
})
openMenu()
// Browsers allow sound only after the player has clicked or pressed a key
for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => music.start())

// Fixed-step simulation: ticks run at the same rate whatever the frame rate is
let lastTime = performance.now()
let pending = 0

function frame(now: number): void {
  requestAnimationFrame(frame) // first, so one failed frame does not stop the game
  pending = Math.min(pending + (now - lastTime) * game.speed, MAX_FRAME_MS)
  lastTime = now
  while (pending >= TICK_MS) {
    game.update(TICK_SECONDS)
    pending -= TICK_MS
  }
  for (const event of events.watch(game.world)) {
    if (event === 'victory' || event === 'defeat') music.hush(6)
    sounds.play(event)
  }
  card.update()
  tutorial.update(game.world, game.paused)
  renderer.draw(game.paused ? 1 : pending / TICK_MS, now / 1000, {
    drag: input.drag,
    hover: input.hover,
    selected: card.cell,
    focus: card.village,
    showRoutes: game.paused,
    marked: tutorial.marked(game.world),
  })
  hud.update()
  replayBar.update()

  const winner = game.world.winner
  if (winner !== null && !endShown) {
    endShown = true
    if (tutorial.active) {
      tutorial.stop()
      screens.tutorialDone(chooseNewMap, openMenu)
    } else {
      showEnd()
    }
  }
}

requestAnimationFrame(frame)
