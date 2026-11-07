import type { Layout } from '../render/layout'

const STEP = 1.25 // zoom factor of one button press or key
const PAN_STEP = 60 // pixels per arrow key press

// Zoom and pan without dragging: the mouse wheel, a touchpad pinch (browsers send it as a wheel event
// with Ctrl held), + / − / 0 keys and the arrows or WASD
export class CameraControls {
  onChange: () => void = () => {}

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly layout: Layout,
  ) {
    canvas.addEventListener('wheel', (event) => this.wheel(event), { passive: false })
    window.addEventListener('keydown', (event) => this.key(event))
  }

  zoomIn(): void {
    this.zoomAtCenter(STEP)
  }

  zoomOut(): void {
    this.zoomAtCenter(1 / STEP)
  }

  showWholeMap(): void {
    this.layout.resetCamera()
    this.onChange()
  }

  private wheel(event: WheelEvent): void {
    event.preventDefault() // keep the page itself from scrolling or zooming
    const pixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY
    // A pinch sends small steps, a mouse wheel big ones
    const factor = Math.exp(-pixels * (event.ctrlKey ? 0.01 : 0.0015))
    const rect = this.canvas.getBoundingClientRect()
    this.layout.zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor)
    this.onChange()
  }

  private key(event: KeyboardEvent): void {
    const pans: Record<string, [number, number]> = {
      ArrowLeft: [PAN_STEP, 0], KeyA: [PAN_STEP, 0],
      ArrowRight: [-PAN_STEP, 0], KeyD: [-PAN_STEP, 0],
      ArrowUp: [0, PAN_STEP], KeyW: [0, PAN_STEP],
      ArrowDown: [0, -PAN_STEP], KeyS: [0, -PAN_STEP],
    }
    if (event.key === '+' || event.key === '=') this.zoomIn()
    else if (event.key === '-') this.zoomOut()
    else if (event.key === '0') this.showWholeMap()
    else if (pans[event.code]) {
      this.layout.panBy(...pans[event.code])
      this.onChange()
    }
  }

  private zoomAtCenter(factor: number): void {
    this.layout.zoomAt(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2, factor)
    this.onChange()
  }
}
