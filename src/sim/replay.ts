import { build, upgradeToTown } from './economy'
import { GameMap } from './map'
import { TICK_SECONDS } from './rules'
import { redirectSquad, sendSquad } from './squads'
import { tick } from './tick'
import type { Order, World } from './world'

const CHECKPOINT_TICKS = 100 // a copy of the world every five seconds of the match

// A match kept for watching again: copies of the world now and then, and the players' orders.
// Any moment is rebuilt from the copy before it by playing the orders on to it, so the AI is not needed
export class Recording {
  private readonly checkpoints: World[] = []

  constructor(readonly live: World) {
    this.update()
  }

  // Called after every tick of the live match. The copies leave the orders out: the replay reads them
  // from the live match, and each copy would otherwise carry the whole log so far, about half its size
  update(): void {
    if (this.live.ticks % CHECKPOINT_TICKS === 0) this.checkpoints.push(copyWorld({ ...this.live, orders: [] }))
  }

  get length(): number {
    return this.live.ticks
  }

  // The match as it stood after this many ticks
  at(ticks: number): World {
    const index = Math.min(Math.floor(ticks / CHECKPOINT_TICKS), this.checkpoints.length - 1)
    const world = copyWorld(this.checkpoints[index])
    while (world.ticks < ticks && world.winner === null) this.step(world)
    return world
  }

  // One tick of the replay: the orders given at this moment, then the world moves on
  step(world: World): void {
    for (const order of this.live.orders) if (order.at === world.ticks) perform(world, order)
    tick(world, TICK_SECONDS)
  }
}

// A deep copy keeps the links between villages, squads and cells; only the map's methods need restoring
function copyWorld(world: World): World {
  const copy = structuredClone(world)
  Object.setPrototypeOf(copy.map, GameMap.prototype)
  return copy
}

function perform(world: World, order: Order): void {
  const cells = world.map.cells
  const village = (index: number) => cells[index].village
  switch (order.kind) {
    case 'send': {
      const from = village(order.from)
      if (from) sendSquad(world, order.player, from, cells[order.to], order.share)
      break
    }
    case 'redirect': {
      const squad = world.squads.find((squad) => squad.id === order.squad)
      if (squad) redirectSquad(world, order.player, squad, cells[order.to])
      break
    }
    case 'build':
      build(world, order.player, cells[order.cell], order.building)
      break
    case 'town': {
      const town = village(order.village)
      if (town) upgradeToTown(world, order.player, town)
      break
    }
  }
}
