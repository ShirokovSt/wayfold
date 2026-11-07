import type { Game } from '../game'
import { onLanguageChange, t } from '../i18n'
import { drawBuilding } from '../render/figures'
import type { Layout } from '../render/layout'
import { ownerTone } from '../render/palette'
import { build, canBuild, canBuildOn } from '../sim/economy'
import { BUILDING_COST } from '../sim/rules'
import { BUILDING_KINDS, type BuildingKind, type Cell, HUMAN } from '../sim/world'
import { element } from './dom'

const ICON_SIZE = 44

// A small panel above the clicked tile with the three buildings and their prices
export class BuildMenu {
  cell: Cell | null = null
  private readonly root = element('div', 'build-menu')
  private buttons = new Map<BuildingKind, HTMLButtonElement>()

  constructor(
    stage: HTMLElement,
    private readonly game: Game,
    private readonly layout: Layout,
  ) {
    this.root.hidden = true
    stage.append(this.root)
    onLanguageChange(() => this.cell && this.render())
  }

  // Opens only where building is allowed at all
  open(cell: Cell): void {
    if (!canBuildOn(this.game.world, HUMAN, cell)) return
    this.cell = cell
    this.render()
    const { x, y } = this.layout.hexToScreen(cell.hex)
    this.root.style.left = `${x}px`
    this.root.style.top = `${y - this.layout.size}px`
    this.root.hidden = false
  }

  close(): void {
    this.cell = null
    this.root.hidden = true
  }

  // Runs every frame: prices turn available as gold comes in; a tile lost to a raid closes the menu
  update(): void {
    if (!this.cell) return
    const world = this.game.world
    if (!canBuildOn(world, HUMAN, this.cell)) {
      this.close()
      return
    }
    for (const [kind, button] of this.buttons) {
      const allowed = canBuild(world, HUMAN, this.cell, kind)
      button.disabled = !allowed || world.gold[HUMAN] < BUILDING_COST[kind]
      button.querySelector('.note')!.textContent = allowed ? '' : t().tooCloseToEnemy
    }
  }

  private render(): void {
    this.buttons = new Map(BUILDING_KINDS.map((kind) => [kind, this.button(kind)]))
    this.root.replaceChildren(...this.buttons.values())
    this.update()
  }

  private button(kind: BuildingKind): HTMLButtonElement {
    const node = element('button', 'building', icon(kind), element('b', '', t().buildings[kind]))
    node.append(element('span', 'cost', element('i', 'coin'), String(BUILDING_COST[kind])), element('small', 'note'))
    node.type = 'button'
    node.title = t().buildingHints[kind]
    node.addEventListener('click', () => {
      if (this.cell && build(this.game.world, HUMAN, this.cell, kind)) this.close()
    })
    return node
  }
}

// The same drawing as on the board, in a little canvas
function icon(kind: BuildingKind): HTMLCanvasElement {
  const canvas = element('canvas', 'icon')
  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.height = ICON_SIZE * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  drawBuilding(ctx, kind, ICON_SIZE / 2, ICON_SIZE * 0.68, ICON_SIZE * 0.75, ownerTone(HUMAN), 0)
  return canvas
}
