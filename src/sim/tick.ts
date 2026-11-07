import { collectGold } from './economy'
import { moveSquads, resolveClashes } from './squads'
import { fireTowers } from './towers'
import { growVillages } from './villages'
import { HUMAN, type PlayerId, RIVAL, type World } from './world'

export function tick(world: World, dt: number): void {
  if (world.winner !== null) return
  world.time += dt
  growVillages(world, dt)
  collectGold(world, dt)
  moveSquads(world, dt)
  fireTowers(world, dt)
  resolveClashes(world)
  world.winner = findWinner(world)
}

// A player is out when they have neither villages nor squads on the march
export function isAlive(world: World, player: PlayerId): boolean {
  return world.villages.some((v) => v.owner === player) || world.squads.some((s) => s.owner === player)
}

function findWinner(world: World): PlayerId | null {
  if (!isAlive(world, HUMAN)) return RIVAL
  if (!isAlive(world, RIVAL)) return HUMAN
  return null
}
