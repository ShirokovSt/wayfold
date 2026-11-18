import type { CameraControls } from '../input/camera'
import { onLanguageChange, t } from '../i18n'
import { button, element } from './dom'

type AppleFullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void
}

type AppleFullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void }

// Camera controls and browser fullscreen in the corner of the board.
export function zoomButtons(stage: HTMLElement, camera: CameraControls): void {
  const root = element('div', 'zoom')
  const zoomIn = button('+', () => camera.zoomIn())
  const zoomOut = button('−', () => camera.zoomOut())
  const whole = button('▦', () => camera.showWholeMap())
  const fullscreen = button('⤢', () => void toggleFullscreen())
  const notice = element('p', 'fullscreen-notice')
  notice.role = 'status'
  notice.hidden = true
  root.append(zoomIn, zoomOut, whole, fullscreen, notice)
  stage.append(root)

  const doc: AppleFullscreenDocument = document
  const target: AppleFullscreenElement = document.documentElement
  const active = () => Boolean(doc.fullscreenElement || doc.webkitFullscreenElement)
  let switching = false
  const say = (message: string) => {
    notice.textContent = message
    notice.hidden = false
  }

  function refreshFullscreen(): void {
    const on = active()
    fullscreen.ariaPressed = String(on)
    label(fullscreen, on ? t().exitFullscreen : t().enterFullscreen)
  }

  async function toggleFullscreen(): Promise<void> {
    if (switching) return
    switching = true
    notice.hidden = true
    try {
      if (doc.fullscreenElement) {
        await doc.exitFullscreen()
      } else if (doc.webkitFullscreenElement) {
        doc.webkitExitFullscreen?.()
      } else if (doc.fullscreenEnabled && target.requestFullscreen) {
        await target.requestFullscreen({ navigationUI: 'hide' })
      } else if (doc.webkitFullscreenEnabled && target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen()
      } else {
        say(fullscreenHelp())
      }
    } catch {
      say(fullscreenHelp(true))
    } finally {
      switching = false
      refreshFullscreen()
    }
  }

  function refreshLabels(): void {
    label(zoomIn, t().zoomIn)
    label(zoomOut, t().zoomOut)
    label(whole, t().wholeMap)
    notice.hidden = true
    refreshFullscreen()
  }

  document.addEventListener('fullscreenchange', refreshFullscreen)
  document.addEventListener('webkitfullscreenchange', refreshFullscreen)
  document.addEventListener('webkitfullscreenerror', () => say(fullscreenHelp(true)))
  document.addEventListener('pointerdown', (event) => {
    if (!root.contains(event.target as Node)) notice.hidden = true
  })
  refreshLabels()
  onLanguageChange(refreshLabels)
}

function label(button: HTMLButtonElement, text: string): void {
  button.title = text
  button.ariaLabel = text
}

function fullscreenHelp(failed = false): string {
  if (window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
    ('standalone' in navigator && navigator.standalone === true)) return t().fullscreenApp
  const appleTouch = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (appleTouch) return t().fullscreenHomeScreen
  return failed ? t().fullscreenFailed : t().fullscreenUnavailable
}
