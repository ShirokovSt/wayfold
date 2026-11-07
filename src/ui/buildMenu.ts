import type { Game } from '../game'
import { onLanguageChange, t } from '../i18n'
import { drawBuilding, drawVillage } from '../render/figures'
import type { Layout } from '../render/layout'
import { ownerTone } from '../render/palette'
import { type Project, build, canBuild, canBuildOn, canUpgrade, costOf, upgradeToTown } from '../sim/economy'
import { BUILDING_KINDS, type Cell, HUMAN } from '../sim/world'
import { element } from './dom'

const ICON_SIZE = 44

// A small panel above the clicked tile with what can be bought there and the prices:
// buildings on an own field, the upgrade to a town on an own village
export class BuildMenu {
  cell: Cell | null = null
  private readonly root = element('div', 'build-menu')
  private buttons = new Map<Project, HTMLButtonElement>()

  constructor(
    stage: HTMLElement,
    private readonly game: Game,
    private readonly layout: Layout,
  ) {
    this.root.hidden = true
    stage.append(this.root)
    onLanguageChange(() => this.cell && this.render())
  }

  open(cell: Cell): void {
    if (this.projects(cell).length === 0) return
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
    const cell = this.cell
    if (!cell) return
    const world = this.game.world
    if (this.projects(cell).length !== this.buttons.size) {
      this.close()
      return
    }
    for (const [project, button] of this.buttons) {
      const allowed = project === 'town' || canBuild(world, HUMAN, cell, project)
      button.disabled = !allowed || world.gold[HUMAN] < costOf(project)
      button.querySelector('.note')!.textContent = allowed ? '' : t().tooCloseToEnemy
    }
  }

  private projects(cell: Cell): Project[] {
    const world = this.game.world
    if (cell.village) return canUpgrade(HUMAN, cell.village) ? ['town'] : []
    return canBuildOn(world, HUMAN, cell) ? [...BUILDING_KINDS] : []
  }

  private render(): void {
    this.buttons = new Map(this.projects(this.cell!).map((project) => [project, this.button(project)]))
    this.root.replaceChildren(...this.buttons.values())
    this.update()
  }

  private button(project: Project): HTMLButtonElement {
    const node = element('button', 'building', icon(project), element('b', '', t().buildings[project]))
    node.append(element('span', 'cost', element('i', 'coin'), String(costOf(project))), element('small', 'note'))
    node.type = 'button'
    node.title = t().buildingHints[project]
    node.addEventListener('click', () => {
      if (this.cell && this.buy(this.cell, project)) this.close()
    })
    return node
  }

  private buy(cell: Cell, project: Project): boolean {
    const world = this.game.world
    if (project === 'town') return cell.village !== null && upgradeToTown(world, HUMAN, cell.village)
    return build(world, HUMAN, cell, project)
  }
}

// The same drawing as on the board, in a little canvas
function icon(project: Project): HTMLCanvasElement {
  const canvas = element('canvas', 'icon')
  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.height = ICON_SIZE * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const tone = ownerTone(HUMAN)
  if (project === 'town') drawVillage(ctx, ICON_SIZE / 2, ICON_SIZE * 0.6, ICON_SIZE * 0.62, tone, 0, true)
  else drawBuilding(ctx, project, ICON_SIZE / 2, ICON_SIZE * 0.68, ICON_SIZE * 0.75, tone)
  return canvas
}
