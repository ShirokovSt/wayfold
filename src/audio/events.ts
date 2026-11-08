import { squadTarget } from '../sim/squads'
import { HUMAN, type Owner, type PlayerId, type Squad, type World } from '../sim/world'

export type SoundEvent = 'send' | 'capture' | 'loss' | 'repelled' | 'build' | 'town' | 'victory' | 'defeat'

// The world as it was on the last frame: the sounds come from what has changed since
interface Snapshot {
  world: World
  owners: Owner[]
  towns: boolean[]
  squads: Set<Squad>
  buildings: Set<number> // indexes of cells with a building
  winner: PlayerId | null
}

// Watches the match without touching the simulation, and hears only what matters to the player
export class EventWatcher {
  private last: Snapshot | null = null

  watch(world: World): SoundEvent[] {
    const last = this.last
    const now = snapshot(world)
    this.last = now
    if (!last || last.world !== world) return [] // a new match starts quietly
    if (world.winner !== null && last.winner === null) return [world.winner === HUMAN ? 'victory' : 'defeat']

    const events = new Set<SoundEvent>()
    world.villages.forEach((village, i) => {
      const before = last.owners[i]
      if (village.owner === HUMAN && before !== HUMAN) events.add('capture')
      else if (before === HUMAN && village.owner !== HUMAN) events.add('loss')
      else if (village.owner === HUMAN && village.town && !last.towns[i]) events.add('town')
    })
    for (const squad of now.squads) if (squad.owner === HUMAN && !last.squads.has(squad)) events.add('send')
    for (const squad of last.squads) {
      if (!now.squads.has(squad) && wasRepelled(squad, last)) events.add('repelled')
    }
    for (const index of now.buildings) {
      if (!last.buildings.has(index) && world.map.cells[index].owner === HUMAN) events.add('build')
    }
    return [...events]
  }
}

// A squad that reached a village of someone else's and left it in the same hands
function wasRepelled(squad: Squad, last: Snapshot): boolean {
  const village = squadTarget(squad).village
  if (!village || squad.step !== squad.path.length - 1) return false // it fell on the way
  const ownerBefore = last.owners[last.world.villages.indexOf(village)]
  return village.owner !== squad.owner && village.owner === ownerBefore && (squad.owner === HUMAN || village.owner === HUMAN)
}

function snapshot(world: World): Snapshot {
  const buildings = new Set<number>()
  for (const cell of world.map.cells) if (cell.building) buildings.add(cell.index)
  return {
    world,
    owners: world.villages.map((village) => village.owner),
    towns: world.villages.map((village) => village.town),
    squads: new Set(world.squads),
    buildings,
    winner: world.winner,
  }
}
