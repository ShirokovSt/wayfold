import type { Game } from '../game'
import { onLanguageChange, t } from '../i18n'
import { drawBuilding, drawVillage } from '../render/figures'
import type { Layout } from '../render/layout'
import { WILD_TONE, ownerTone } from '../render/palette'
import { type Project, build, canBuild, canBuildOn, canUpgrade, costOf, upgradeToTown } from '../sim/economy'
import { BUILDING_KINDS, type Cell, HUMAN, type Village } from '../sim/world'
import { element } from './dom'
import { icon } from './icons'
import { type TileInfo, describeEstate, describeTile, linkedVillage } from './tileInfo'

const ICON_SIZE = 44
const MARGIN = 8 // pixels the card keeps from the edges of the board

// A small card by the clicked tile: what is there and whose, and below it what can be bought there:
// buildings on an own field, the upgrade to a town on an own village
export class TileCard {
  cell: Cell | null = null
  private readonly root = element('div', 'tile-card')
  private readonly info = element('div', 'card-info')
  private readonly actions = element('div', 'card-actions')
  private buttons = new Map<Project, HTMLButtonElement>()
  private shown = '' // the info drawn last: the page is touched only when it changes

  constructor(
    private readonly stage: HTMLElement,
    private readonly game: Game,
    private readonly layout: Layout,
  ) {
    this.root.hidden = true
    this.root.append(this.info, this.actions)
    stage.append(this.root)
    onLanguageChange(() => {
      this.shown = ''
      if (this.cell) this.renderButtons()
    })
  }

  // Lit on the board: the village the card is about, or the one whose estate its tile is in
  get village(): Village | null {
    return this.cell && linkedVillage(this.game.world, this.cell)
  }

  open(cell: Cell): void {
    if (!this.describe(cell) && this.projects(cell).length === 0) return
    this.cell = cell
    this.shown = ''
    this.renderButtons()
    this.root.hidden = false
    this.update()
  }

  close(): void {
    this.cell = null
    this.root.hidden = true
  }

  // Runs every frame: the numbers change, prices turn available as gold comes in, the card follows its tile
  update(): void {
    const cell = this.cell
    if (!cell) return
    const world = this.game.world
    const info = this.describe(cell)
    const projects = this.projects(cell)
    if (!info && projects.length === 0) {
      this.close() // e.g. a den cleared or a tile lost to a raid
      return
    }
    if (projects.length !== this.buttons.size) this.renderButtons()
    this.renderInfo(info)
    for (const [project, button] of this.buttons) {
      const allowed = project === 'town' || canBuild(world, HUMAN, cell, project)
      button.disabled = !allowed || world.gold[HUMAN] < costOf(project)
      button.querySelector('.note')!.textContent = allowed ? '' : t().tooCloseToEnemy
    }
    this.place(cell)
  }

  private describe(cell: Cell): TileInfo | null {
    const world = this.game.world
    return describeTile(world, cell) ?? (canBuildOn(world, HUMAN, cell) ? describeEstate(world, cell) : null)
  }

  // Nothing is bought while watching a replay or after the match
  private projects(cell: Cell): Project[] {
    const world = this.game.world
    if (this.game.watching || world.winner !== null) return []
    if (cell.village) return canUpgrade(HUMAN, cell.village) ? ['town'] : []
    return canBuildOn(world, HUMAN, cell) ? [...BUILDING_KINDS] : []
  }

  private renderInfo(info: TileInfo | null): void {
    const key = JSON.stringify(info)
    if (key === this.shown) return
    this.shown = key
    if (!info) {
      this.info.replaceChildren()
      return
    }
    const dot = element('i', 'dot')
    dot.style.background = (info.owner === 'wild' ? WILD_TONE : ownerTone(info.owner)).main
    const head = element('header', '', dot, element('b', '', info.title))
    if (info.kind) head.append(element('span', 'kind', info.kind))
    const rows = info.rows.map((row) =>
      element('p', '', ...row.map((item) => element('span', 'item', ...(item.icon ? [icon(item.icon)] : []), item.text))))
    this.info.replaceChildren(head, ...rows)
  }

  private renderButtons(): void {
    this.buttons = new Map(this.projects(this.cell!).map((project) => [project, this.button(project)]))
    this.actions.replaceChildren(...this.buttons.values())
    this.actions.hidden = this.buttons.size === 0
  }

  // Above the tile, or below it if there is no room; hidden while the tile is scrolled out of view
  private place(cell: Cell): void {
    const { x, y } = this.layout.hexToScreen(cell.hex)
    const size = this.layout.size
    const width = this.stage.clientWidth
    const height = this.stage.clientHeight
    this.root.hidden = x < 0 || y < 0 || x > width || y > height
    const card = this.root.getBoundingClientRect()
    const left = Math.min(Math.max(x, card.width / 2 + MARGIN), width - card.width / 2 - MARGIN)
    const above = y - size - card.height
    this.root.style.left = `${left}px`
    this.root.style.top = `${above >= MARGIN ? above : y + size}px`
  }

  private button(project: Project): HTMLButtonElement {
    const node = element('button', 'building', picture(project), element('b', '', t().buildings[project]))
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
function picture(project: Project): HTMLCanvasElement {
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
