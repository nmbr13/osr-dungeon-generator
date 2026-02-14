import type { GraphData, DungeonNode, DungeonLink, RoomType } from '../types'
import { randomConnectionType } from './connectionRoll'

// 10 layouts: each is 6 edges between node indices 0..5 (at least one loop, no single big loop).
// Edges as [min, max] pairs. Every layout uses all 6 nodes and is connected.
const LAYOUTS: [number, number][][] = [
  [[0, 1], [1, 2], [2, 0], [0, 3], [1, 4], [2, 5]], // triangle + 3 legs
  [[0, 1], [1, 2], [2, 0], [0, 3], [0, 4], [4, 5]], // triangle + 2 on 0, then 4-5 leg
  [[0, 1], [1, 2], [2, 0], [0, 3], [1, 4], [1, 5]], // triangle + 3 distributed
  [[0, 1], [1, 2], [2, 0], [0, 3], [0, 4], [0, 5]], // triangle + all 3 on 0
  [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [2, 5]], // square + 2 separated
  [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 5]], // square + 2 in line
  [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [0, 5]], // square + 2 on same corner
  [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 5]], // pentagon + 1
  [[0, 1], [1, 2], [2, 3], [0, 3], [3, 4], [4, 5]], // square 0-1-2-3-0 + leg 3-4-5 (no single loop)
  [[0, 1], [1, 2], [2, 0], [2, 3], [0, 4], [1, 5]], // triangle variant
]

const ROOM_TYPES: RoomType[] = [
  'monster_treasure',
  'monster',
  'treasure',
  'empty',
  'empty',
  'empty',
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function generateId(): string {
  return `room-${Math.random().toString(36).slice(2, 10)}`
}

export function generateBiteSizedDungeon(seedLayout?: number): GraphData {
  const layoutIndex = seedLayout ?? randomInt(0, LAYOUTS.length - 1)
  const edges = LAYOUTS[layoutIndex]

  const nodeIds = Array.from({ length: 6 }, () => generateId())
  const shuffledTypes = shuffle(ROOM_TYPES)
  const oneSpecial = randomInt(0, 2) === 0
  const types: RoomType[] = shuffledTypes.map((t, i) =>
    t === 'empty' && oneSpecial && i === shuffledTypes.indexOf('empty')
      ? 'special'
      : t
  )

  const entranceIndex = randomInt(0, 5)
  const secondEntrance = randomInt(0, 5)
  const entrances = new Set([entranceIndex, secondEntrance])

  const nodes: DungeonNode[] = nodeIds.map((id, i) => ({
    id,
    label: `Room ${i + 1}`,
    roomType: types[i],
    content: getDefaultContent(types[i]),
    entrance: entrances.has(i),
  }))

  const linkSet = new Set<string>()
  const links: DungeonLink[] = edges.map(([a, b]) => {
    const idA = nodeIds[a]
    const idB = nodeIds[b]
    const key = [idA, idB].sort().join('-')
    if (linkSet.has(key)) throw new Error('Duplicate edge')
    linkSet.add(key)
    return {
      source: idA,
      target: idB,
      connectionType: randomConnectionType(),
    }
  })

  return { nodes, links }
}

function getDefaultContent(roomType: RoomType): string {
  switch (roomType) {
    case 'monster_treasure':
      return '**Monster + Treasure**\n\nDescribe the encounter and the treasure here.'
    case 'monster':
      return '**Monster**\n\nDescribe the encounter.'
    case 'treasure':
      return '**Treasure** (hidden or trapped)\n\nDescribe how it’s hidden or the trap.'
    case 'special':
      return '**Special**\n\nPuzzle, trick, or unusual feature.'
    default:
      return '**Empty**\n\nSet dressing and any minor details.'
  }
}
