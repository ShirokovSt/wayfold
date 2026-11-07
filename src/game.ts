import { Rival } from './ai/rival'
import { createRandom } from './core/rng'
import { createWorld } from './sim/mapgen'
import { tick } from './sim/tick'
import { RIVAL, type World } from './sim/world'

// One match: the world plus the AI that plays against you
export class Game {
  world!: World
  paused = true
  private rival!: Rival

  constructor(seed: number) {
    this.restart(seed)
  }

  restart(seed: number): void {
    this.world = createWorld(seed)
    this.rival = new Rival(RIVAL, createRandom(seed + 1))
  }

  update(dt: number): void {
    if (this.paused || this.world.winner !== null) return
    this.rival.update(this.world, dt)
    tick(this.world, dt)
  }
}
