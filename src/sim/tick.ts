import { updateBeasts } from './beasts'
import { collectGold } from './economy'
import { moveSquads, resolveClashes } from './squads'
import { fireTowers } from './towers'
import { growVillages } from './villages'
import { HUMAN, type PlayerId, type World } from './world'

export function tick(world: World, dt: number): void {
  if (world.winner !== null) return
  world.time += dt
  world.ticks++
  growVillages(world, dt)
  collectGold(world, dt)
  moveSquads(world, dt)
  updateBeasts(world, dt)
  fireTowers(world, dt)
  resolveClashes(world)
  updatePlayers(world)
}

// A player is out when they have neither villages nor squads on the march
export function isAlive(world: World, player: PlayerId): boolean {
  return world.villages.some((v) => v.owner === player) || world.squads.some((s) => s.owner === player)
}

export function isOut(world: World, player: PlayerId): boolean {
  return world.out.some((out) => out.player === player)
}

// Notes who has just fallen; the match is over when you are the last one standing, or when you fall
function updatePlayers(world: World): void {
  for (const player of world.players) {
    if (!isOut(world, player) && !isAlive(world, player)) world.out.push({ player, time: world.time })
  }
  const standing = world.players.filter((player) => !isOut(world, player))
  if (isOut(world, HUMAN)) world.winner = leader(world, standing.length > 0 ? standing : world.players.slice(1))
  else if (standing.length === 1) world.winner = HUMAN
}

// The one with the most villages, then the most land; on a tie the one who fell last
export function leader(world: World, players: PlayerId[]): PlayerId {
  const villages = (player: PlayerId) => world.villages.filter((village) => village.owner === player).length
  const land = (player: PlayerId) => world.map.cells.filter((cell) => cell.owner === player).length
  const fell = (player: PlayerId) => world.out.find((out) => out.player === player)?.time ?? Infinity
  return [...players].sort((a, b) => villages(b) - villages(a) || land(b) - land(a) || fell(b) - fell(a))[0]
}

// Places from the first: the winner, those still standing by villages and land, then the fallen, latest first
export function standings(world: World): PlayerId[] {
  const standing = world.players.filter((player) => !isOut(world, player))
  const ranked: PlayerId[] = []
  while (standing.length > 0) {
    const next = leader(world, standing)
    ranked.push(next)
    standing.splice(standing.indexOf(next), 1)
  }
  const fallen = [...world.out].reverse().map((out) => out.player)
  if (world.winner !== null && fallen.includes(world.winner)) return [world.winner, ...fallen.filter((p) => p !== world.winner)]
  return [...ranked, ...fallen]
}
