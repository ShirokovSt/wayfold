import type { CameraControls } from '../input/camera'
import { onLanguageChange, t } from '../i18n'
import { button, element } from './dom'

// + / − / whole map buttons in the corner of the board, for touchpads and touch screens
export function zoomButtons(stage: HTMLElement, camera: CameraControls): void {
  const root = element('div', 'zoom')
  const build = () => {
    const zoomIn = button('+', () => camera.zoomIn())
    const zoomOut = button('−', () => camera.zoomOut())
    const whole = button('⤢', () => camera.showWholeMap())
    zoomIn.title = t().zoomIn
    zoomOut.title = t().zoomOut
    whole.title = t().wholeMap
    root.replaceChildren(zoomIn, zoomOut, whole)
  }
  build()
  onLanguageChange(build)
  stage.append(root)
}
