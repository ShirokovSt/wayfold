import type { Game } from '../game'
import { onLanguageChange, t } from '../i18n'
import { drawBuilding, drawVillage } from '../render/figures'
import type { Layout } from '../render/layout'
import { STEEL, WILD_TONE, WOOD, ownerTone } from '../render/palette'
import {
  type Project, build, canBuild, canBuildOn, canClear, canSell, canUpgrade, clearForest, costOf, refundOf, sell, upgradeToTown,
} from '../sim/economy'
import { BUILDING_KINDS, type BuildingKind, type Cell, HUMAN, type Village } from '../sim/world'
import { element } from './dom'
import { icon } from './icons'
import { type TileInfo, describeEstate, describeTile, linkedVillage } from './tileInfo'

const ICON_SIZE = 44
const MARGIN = 8 // pixels the card keeps from the edges of the board
// The stump icon: colors, and the axe's lean and size
const AXE = { cut: '#e9cf9a', handle: '#d0995e', slit: '#3a2416', bevel: '#dfe4ea', tilt: (40 * Math.PI) / 180, scale: 0.85 }

// What the card offers: something to buy, or the building on the tile to tear down
type Action = Project | 'sell'

// A small card by the clicked tile: what is there and whose, and below it what can be done there:
// buildings on an own field, the upgrade to a town on an own village, tearing down an own building,
// cutting down an own forest
export class TileCard {
  cell: Cell | null = null
  private readonly root = element('div', 'tile-card')
  private readonly info = element('div', 'card-info')
  private readonly actions = element('div', 'card-actions')
  private buttons = new Map<Action, HTMLButtonElement>()
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
    if (!this.describe(cell) && this.offers(cell).length === 0) return
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
    const actions = this.offers(cell)
    if (!info && actions.length === 0) {
      this.close() // e.g. a den cleared or a tile lost to a raid
      return
    }
    if (actions.some((action) => !this.buttons.has(action)) || actions.length !== this.buttons.size) this.renderButtons()
    this.renderInfo(info)
    for (const [action, button] of this.buttons) {
      const allowed = this.allowed(cell, action)
      // Tearing down brings gold in, so only the place can stop it
      button.disabled = !allowed || (action !== 'sell' && world.gold[HUMAN] < costOf(action))
      const why = action === 'sell' || action === 'clear' ? t().onlyInEstate : t().tooCloseToEnemy
      button.querySelector('.note')!.textContent = allowed ? '' : why
    }
    this.place(cell)
  }

  private describe(cell: Cell): TileInfo | null {
    const world = this.game.world
    const own = canBuildOn(world, HUMAN, cell) || ownForest(cell)
    return describeTile(world, cell) ?? (own ? describeEstate(world, cell) : null)
  }

  private allowed(cell: Cell, action: Action): boolean {
    const world = this.game.world
    if (action === 'sell') return canSell(world, HUMAN, cell)
    if (action === 'clear') return canClear(world, HUMAN, cell)
    return action === 'town' || canBuild(world, HUMAN, cell, action)
  }

  // Nothing is done while watching a replay or after the match
  private offers(cell: Cell): Action[] {
    const world = this.game.world
    if (this.game.watching || world.winner !== null) return []
    if (cell.village) return canUpgrade(HUMAN, cell.village) ? ['town'] : []
    // Your buildings and forests outside your estates get the button too, greyed, with the reason
    if (cell.owner === HUMAN && cell.building) return ['sell']
    if (ownForest(cell)) return ['clear']
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
    const cell = this.cell!
    const button = (action: Action) => (action === 'sell' ? this.sellButton(cell.building!.kind) : this.button(action))
    this.buttons = new Map(this.offers(cell).map((action) => [action, button(action)]))
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

  // The building goes for part of its price, shown with a plus as it brings gold in
  private sellButton(kind: BuildingKind): HTMLButtonElement {
    const strings = t()
    const node = element('button', 'building', picture(kind), element('b', '', strings.sell))
    node.append(element('span', 'cost', '+', element('i', 'coin'), String(refundOf(kind))), element('small', 'note'))
    node.type = 'button'
    node.title = strings.sellHint(refundOf(kind))
    node.addEventListener('click', () => {
      if (this.cell && sell(this.game.world, HUMAN, this.cell)) this.close()
    })
    return node
  }

  private buy(cell: Cell, project: Project): boolean {
    const world = this.game.world
    if (project === 'town') return cell.village !== null && upgradeToTown(world, HUMAN, cell.village)
    if (project === 'clear') return clearForest(world, HUMAN, cell)
    return build(world, HUMAN, cell, project)
  }
}

function ownForest(cell: Cell): boolean {
  return cell.owner === HUMAN && cell.terrain === 'forest' && !cell.village
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
  else if (project === 'clear') drawStump(ctx, ICON_SIZE)
  else drawBuilding(ctx, project, ICON_SIZE / 2, ICON_SIZE * 0.68, ICON_SIZE * 0.75, tone)
  return canvas
}

// A tree stump with an axe stuck in it, the lower corner of its blade in the cut. Sizes are parts of the icon
function drawStump(ctx: CanvasRenderingContext2D, size: number): void {
  const p = (x: number, y: number): [number, number] => [x * size, y * size]
  const line = 0.03 // outlines
  const x = 0.45
  const top = 0.67 // the middle of the cut
  const rx = 0.25
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Bark, spreading into roots at the ground, with a few cracks
  ctx.fillStyle = WOOD.trunk
  ctx.strokeStyle = WOOD.roof
  ctx.lineWidth = size * line
  ctx.beginPath()
  ctx.moveTo(...p(x - rx, top))
  ctx.lineTo(...p(x - rx, top + 0.18))
  ctx.quadraticCurveTo(...p(x - rx - 0.02, top + 0.25), ...p(x - rx - 0.07, top + 0.28))
  ctx.lineTo(...p(x + rx + 0.07, top + 0.28))
  ctx.quadraticCurveTo(...p(x + rx + 0.02, top + 0.25), ...p(x + rx, top + 0.18))
  ctx.lineTo(...p(x + rx, top))
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = size * 0.022
  ctx.beginPath()
  for (const dx of [-0.12, 0.01, 0.13]) {
    ctx.moveTo(...p(x + dx, top + 0.1))
    ctx.lineTo(...p(x + dx, top + 0.2))
  }
  ctx.stroke()
  // The cut, with its rings
  ctx.fillStyle = AXE.cut
  ctx.lineWidth = size * line
  ctx.beginPath()
  ctx.ellipse(...p(x, top), rx * size, 0.075 * size, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = size * 0.015
  ctx.beginPath()
  ctx.ellipse(...p(x, top), rx * 0.5 * size, 0.037 * size, 0, 0, Math.PI * 2)
  ctx.stroke()

  // The axe is drawn in its own frame, so its parts line up: the eye of the head at 0, 0,
  // x along the handle, y across it toward the blade
  const toAxe = () => {
    ctx.translate(...p(0.36, 0.477))
    ctx.rotate(-AXE.tilt)
    ctx.scale(AXE.scale * size, AXE.scale * size)
  }
  const outline = line / AXE.scale
  // The handle: an outline, then the wood
  ctx.save()
  toAxe()
  for (const [color, width] of [[WOOD.roof, 0.075 + outline * 2], [AXE.handle, 0.075]] as const) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0.62, 0)
    ctx.stroke()
  }
  ctx.restore()
  // The blade, widening from the eye to a round cutting edge with a bright bevel along it;
  // what is below the cut is in the wood
  const blade = () => {
    ctx.beginPath()
    ctx.moveTo(-0.05, 0.05)
    ctx.lineTo(0.05, 0.05)
    ctx.quadraticCurveTo(0.08, 0.16, 0.15, 0.25)
    ctx.quadraticCurveTo(0.03, 0.33, -0.11, 0.25)
    ctx.quadraticCurveTo(-0.07, 0.16, -0.05, 0.05)
    ctx.closePath()
  }
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, size, top * size)
  ctx.clip()
  toAxe()
  ctx.fillStyle = STEEL.main
  blade()
  ctx.fill()
  ctx.save()
  blade()
  ctx.clip()
  ctx.fillStyle = AXE.bevel
  ctx.beginPath()
  ctx.moveTo(0.15, 0.25)
  ctx.quadraticCurveTo(0.03, 0.33, -0.11, 0.25)
  ctx.lineTo(-0.11, 0.21)
  ctx.quadraticCurveTo(0.03, 0.29, 0.15, 0.21)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = STEEL.dark
  ctx.lineWidth = outline
  blade()
  ctx.stroke()
  ctx.restore()
  // The eye: a block of steel centred on the handle
  ctx.save()
  toAxe()
  ctx.fillStyle = STEEL.main
  ctx.strokeStyle = STEEL.dark
  ctx.lineWidth = outline
  ctx.beginPath()
  ctx.rect(-0.065, -0.06, 0.13, 0.12)
  ctx.fill()
  ctx.stroke()
  ctx.restore()

  // The slit where the blade crosses the cut
  ctx.strokeStyle = AXE.slit
  ctx.lineWidth = size * line
  ctx.beginPath()
  ctx.moveTo(...p(0.415, top))
  ctx.lineTo(...p(0.51, top))
  ctx.stroke()
  ctx.lineCap = 'butt'
}
