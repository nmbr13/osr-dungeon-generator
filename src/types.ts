export type RoomType =
  | 'monster_treasure'
  | 'monster'
  | 'treasure'
  | 'special'
  | 'empty'

export type ConnectionType =
  | 'open'
  | 'closed'
  | 'trapped'
  | 'hazardous'
  | 'secret'

export interface DungeonNode {
  id: string
  label: string
  roomType: RoomType
  content: string
  entrance?: boolean
  parentNodeId?: string
}

export interface DungeonLink {
  source: string
  target: string
  connectionType: ConnectionType
  description?: string
  /** For secret: the node id of the room where the clue that reveals this passage is found. */
  clueRoomId?: string
}

export interface GraphData {
  nodes: DungeonNode[]
  links: DungeonLink[]
}
