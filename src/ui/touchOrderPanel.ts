import { onLanguageChange, t } from '../i18n'
import type { TouchOrders } from '../input/touchOrders'
import { strengthOf } from '../sim/villages'
import { HUMAN, type Cell } from '../sim/world'
import { button, element } from './dom'

export class TouchOrderPanel {
  private readonly root = element('section', 'touch-order')
  private readonly title = element('strong', 'order-title')
  private readonly cancel = button('×', () => this.orders.clear(), 'panel-close')
  private readonly half = button('', () => this.share('half'))
  private readonly all = button('', () => this.share('all'))
  private readonly group = button('', () => this.orders.grouping = !this.orders.grouping)
  private readonly details = button('', () => {
    const cell = this.orders.draft?.villages[0]?.cell
    if (cell) this.openDetails(cell)
  })
  private readonly send = button('', () => this.confirm(), 'primary')
  private readonly target = element('p', 'order-target')
  private readonly status = element('div', 'order-status')
  private statusTimer = 0

  constructor(
    stage: HTMLElement,
    private readonly orders: TouchOrders,
    private readonly openDetails: (cell: Cell) => void,
    private readonly confirm: () => void,
  ) {
    this.root.append(
      element('header', 'order-header', this.title, this.cancel),
      element('div', 'order-share', this.half, this.all),
      this.target,
      element('div', 'order-actions', this.group, this.details, this.send),
    )
    this.status.role = 'status'
    this.root.hidden = true
    this.status.hidden = true
    stage.append(this.root, this.status)
    onLanguageChange(() => this.update())
  }

  announce(paused: boolean): void {
    window.clearTimeout(this.statusTimer)
    this.status.hidden = false
    this.status.textContent = paused ? t().touchOrder.queued : t().touchOrder.issued
    this.statusTimer = window.setTimeout(() => this.clearStatus(), 1800)
  }

  clearStatus(): void {
    window.clearTimeout(this.statusTimer)
    this.status.hidden = true
  }

  update(): void {
    const draft = this.orders.draft
    this.root.hidden = !draft
    if (!draft) return
    const strings = t().touchOrder
    const squad = draft.squads[0]
    const village = draft.villages[0]
    const group = draft.villages.length > 1
    const grouping = this.orders.grouping
    const reachable = draft.paths.length > 0
    const count = this.orders.count(draft.share, !!draft.target)
    setText(this.title, squad ? strings.squad(squad.count) : group ? strings.villages(draft.villages.length) : t().villageName(village.name))
    this.cancel.ariaLabel = strings.cancel
    this.half.parentElement!.hidden = !!squad
    this.half.ariaPressed = String(draft.share === 'half')
    this.all.ariaPressed = String(draft.share === 'all')
    setText(this.half, strings.half(this.orders.count('half')))
    setText(this.all, strings.all(this.orders.count('all')))
    this.group.hidden = !!squad
    this.group.ariaPressed = String(grouping)
    setText(this.group, grouping ? strings.done : strings.group)
    this.details.hidden = !!squad || group || grouping
    setText(this.details, strings.details)
    setText(this.send, squad ? strings.redirect : strings.send(count))
    this.send.disabled = grouping || !reachable || (!squad && count === 0)
    const destination = draft.target?.village
    const name = destination ? t().villageName(destination.name) : strings.tile
    const defence = destination && destination.owner !== HUMAN
      ? ` · ${strings.defence(Math.floor(destination.population) * strengthOf(destination))}` : ''
    setText(this.target, grouping ? strings.chooseGroup : !draft.target ? strings.chooseTarget
      : !reachable ? strings.noRoute : strings.target(name) + defence)
  }

  private share(share: 'half' | 'all'): void {
    if (this.orders.draft) this.orders.draft.share = share
  }
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text
}
