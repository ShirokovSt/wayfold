import { Rival } from './ai/rival'
import { createRandom } from './core/rng'
import { createWorld } from './sim/mapgen'
import { tick } from './sim/tick'
import { RIVAL, type World } from './sim/world'

// One match: the world plus the AI that plays against you
export class Game {
  world!: World
  paused = true
  started = false // false while the start screen is up
  speed = 1 // how many game seconds pass in a real second
  private rival!: Rival

  constructor(seed: number) {
    this.restart(seed)
  }

  restart(seed: number): void {
    this.world = createWorld(seed)
    this.started = false
    this.rival = new Rival(RIVAL, createRandom(seed + 1))
  }

  update(dt: number): void {
    if (this.paused || this.world.winner !== null) return
    this.rival.update(this.world, dt)
    tick(this.world, dt)
  }
}
