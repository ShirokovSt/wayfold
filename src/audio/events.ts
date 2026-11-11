import { packTarget } from '../sim/beasts'
import { squadTarget } from '../sim/squads'
import { type Cell, HUMAN, type Lair, type Owner, type Pack, type PlayerId, type Squad, type World } from '../sim/world'

export type SoundEvent =
  | 'send' | 'capture' | 'loss' | 'repelled' | 'build' | 'town' | 'victory' | 'defeat' | 'howl' | 'growl'

// The world as it was on the last frame: the sounds come from what has changed since
interface Snapshot {
  world: World
  owners: Owner[]
  towns: boolean[]
  squads: Set<Squad>
  buildings: Set<number> // indexes of cells with a building
  lairs: Set<Lair>
  packs: Map<Pack, { returning: boolean; target: Cell }> // where each was running then
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
    // Wolves: a howl when a pack sets off for your village, a growl when it gets there; a cleared den rings like a capture
    for (const lair of last.lairs) if (!now.lairs.has(lair) && lair.cell.owner === HUMAN) events.add('capture')
    for (const pack of now.packs.keys()) {
      if (!last.packs.has(pack) && packTarget(pack).village?.owner === HUMAN) events.add('howl')
    }
    for (const [pack, before] of last.packs) {
      if (before.returning) continue
      // It turned home, or fell at the village: either way it got there
      const struck = now.packs.get(pack)?.returning === true || (!now.packs.has(pack) && pack.step === pack.path.length - 1)
      if (struck && before.target.village?.owner === HUMAN) events.add('growl')
    }
    return [...events]
  }
}

// A squad that reached a village of someone else's and left it in the same hands, or lost to a den's pack
function wasRepelled(squad: Squad, last: Snapshot): boolean {
  if (squad.step !== squad.path.length - 1) return false // it fell on the way
  const target = squadTarget(squad)
  if (target.lair) return squad.owner === HUMAN
  const village = target.village
  if (!village) return false
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
    lairs: new Set(world.lairs),
    packs: new Map(world.packs.map((pack) => [pack, { returning: pack.returning, target: packTarget(pack) }])),
    winner: world.winner,
  }
}
