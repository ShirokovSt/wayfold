import './ui/styles.css'
import logoUrl from './assets/logo.svg'
import { Game } from './game'
import { currentLanguage, onLanguageChange, t } from './i18n'
import { PointerInput } from './input/pointer'
import { Renderer } from './render/renderer'
import { TICK_SECONDS } from './sim/rules'
import { HUMAN } from './sim/world'
import { Hud } from './ui/hud'
import { Screens } from './ui/screens'

const TICK_MS = TICK_SECONDS * 1000
const MAX_FRAME_MS = 250 // after a long pause, don't try to catch up

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
const hud = new Hud(document.querySelector('#hud')!, game, { togglePause, newMap })
let endShown = false

function play(): void {
  game.paused = false
  screens.hide()
}

function togglePause(): void {
  if (game.world.winner !== null) return
  if (game.paused) {
    play()
  } else {
    game.paused = true
    screens.paused(play)
  }
}

function newMap(): void {
  game.restart(Date.now())
  renderer.setWorld(game.world)
  input.drag = null
  endShown = false
  play()
}

const hint = document.querySelector('#hint')!
const showHint = () => (hint.textContent = t().hint)
showHint()
onLanguageChange(showHint)

new ResizeObserver(() => renderer.resize()).observe(canvas)
window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space') return
  event.preventDefault() // otherwise Space would also press the focused button
  togglePause()
})
screens.start(play)

// Fixed-step simulation: ticks run at the same rate whatever the frame rate is
let lastTime = performance.now()
let pending = 0

function frame(now: number): void {
  pending = Math.min(pending + now - lastTime, MAX_FRAME_MS)
  lastTime = now
  while (pending >= TICK_MS) {
    game.update(TICK_SECONDS)
    pending -= TICK_MS
  }
  renderer.draw(game.paused ? 1 : pending / TICK_MS, now / 1000, input.drag)
  hud.update()

  const winner = game.world.winner
  if (winner !== null && !endShown) {
    endShown = true
    screens.end(winner === HUMAN, game.world.time, newMap)
  }
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
