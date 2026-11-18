import type { Game } from '../game'
import { findPath } from '../sim/pathfind'
import { redirectSquad, sendSquad, squadCell, squadSize } from '../sim/squads'
import { HUMAN, type Cell, type Squad, type Village } from '../sim/world'
import type { Drag } from './pointer'

// A touch order lives across taps. Only confirmation writes an order to the world.
export class TouchOrders {
  draft: Drag | null = null
  grouping = false
  private world: Game['world'] | null = null
  private pathTick = 0

  constructor(private readonly game: Game) {}

  start(source: Village | Squad): void {
    this.clear()
    this.world = this.game.world
    this.draft = {
      villages: 'cell' in source ? [source] : [],
      squads: 'cell' in source ? [] : [source],
      target: null, paths: [], share: 'half',
    }
  }

  clear(): void {
    this.draft = null
    this.world = null
    this.grouping = false
  }

  tap(cell: Cell): void {
    const draft = this.draft
    if (!draft) return
    if (this.grouping) {
      const village = cell.village
      if (village?.owner !== HUMAN || village.population < 1) return
      const index = draft.villages.indexOf(village)
      if (index === -1) draft.villages.push(village)
      else if (draft.villages.length > 1) draft.villages.splice(index, 1)
      if (draft.target === cell && draft.villages.includes(village)) draft.target = null
    } else {
      draft.target = cell
    }
    this.plan(draft)
  }

  update(): void {
    const draft = this.draft
    const world = this.game.world
    if (!draft) return
    if (world !== this.world || this.game.watching || world.winner !== null) {
      this.clear()
      return
    }
    const villages = draft.villages.filter((village) => village.owner === HUMAN)
    const squads = draft.squads.filter((squad) => world.squads.includes(squad) && squad.owner === HUMAN)
    const changed = villages.length !== draft.villages.length || squads.length !== draft.squads.length
    if (villages.length + squads.length === 0) {
      this.clear()
    } else if (changed || (draft.target && world.ticks - this.pathTick >= 5)) {
      draft.villages = villages
      draft.squads = squads
      this.plan(draft)
    }
  }

  count(share: Drag['share'], reachableOnly = false): number {
    const draft = this.draft
    if (!draft) return 0
    return draft.villages.reduce((total, village) => total +
      (reachableOnly && !draft.paths.some((path) => path[0] === village.cell) ? 0 : squadSize(village.population, share)), 0)
  }

  confirm(): boolean {
    this.update()
    const draft = this.draft
    const world = this.game.world
    if (!draft?.target || this.grouping) return false
    let sent = false
    for (const village of draft.villages) {
      if (sendSquad(world, HUMAN, village, draft.target, draft.share)) sent = true
    }
    for (const squad of draft.squads) {
      if (redirectSquad(world, HUMAN, squad, draft.target)) sent = true
    }
    if (sent) this.clear()
    else this.plan(draft)
    return sent
  }

  private plan(draft: Drag): void {
    const { target } = draft
    const { map, ticks } = this.game.world
    this.pathTick = ticks
    draft.paths = []
    if (!target) return
    for (const village of draft.villages) {
      if (village.cell === target) continue
      const path = findPath(map, village.cell, target)
      if (path) draft.paths.push(path)
    }
    for (const squad of draft.squads) {
      const from = squadCell(squad)
      const path = from === target ? [from, from] : findPath(map, from, target)
      if (path) draft.paths.push(path)
    }
  }
}
