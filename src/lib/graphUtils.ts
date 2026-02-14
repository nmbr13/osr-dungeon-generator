import type { GraphData, DungeonNode, DungeonLink, ConnectionType } from '../types'
import { generateBiteSizedDungeon } from './biteSizedGenerator'
import { randomConnectionType } from './connectionRoll'

export function updateNode(
  g: GraphData,
  nodeId: string,
  updates: Partial<Pick<DungeonNode, 'label' | 'content' | 'entrance'>>
): GraphData {
  return {
    ...g,
    nodes: g.nodes.map((n) =>
      n.id === nodeId ? { ...n, ...updates } : n
    ),
  }
}

export function updateEdge(
  g: GraphData,
  source: string,
  target: string,
  updates: Partial<Pick<DungeonLink, 'connectionType' | 'description' | 'clueRoomId'>>
): GraphData {
  const norm = (a: string, b: string) => [a, b].sort().join('-')
  const key = norm(source, target)
  return {
    ...g,
    links: g.links.map((l) => {
      const lkey = norm(l.source, l.target)
      return lkey === key ? { ...l, ...updates } : l
    }),
  }
}

export function addEdge(
  g: GraphData,
  source: string,
  target: string,
  connectionType: ConnectionType
): GraphData {
  if (source === target) return g
  const norm = (a: string, b: string) => [a, b].sort().join('-')
  const key = norm(source, target)
  const exists = g.links.some((l) => norm(l.source, l.target) === key)
  if (exists) return g
  return {
    ...g,
    links: [...g.links, { source, target, connectionType }],
  }
}

/** Attach a new 6-room dungeon to this room (room stays, one new link). */
export function attachDungeon(g: GraphData, nodeId: string): GraphData {
  const node = g.nodes.find((n) => n.id === nodeId)
  if (!node) return g

  const sub = generateBiteSizedDungeon()
  const bridgeNodeId = sub.nodes[0].id
  const corridorType = randomConnectionType()

  const newNodes: DungeonNode[] = sub.nodes.map((n) => ({
    ...n,
    parentNodeId: nodeId,
    entrance: false,
  }))

  const newLinks: DungeonLink[] = sub.links.map((l) => ({
    ...l,
    source: l.source,
    target: l.target,
  }))

  const connectingLink: DungeonLink = {
    source: nodeId,
    target: bridgeNodeId,
    connectionType: corridorType,
  }

  return {
    nodes: [...g.nodes, ...newNodes],
    links: [...g.links, ...newLinks, connectingLink],
  }
}

/** Replace this room with a 6-room sub-dungeon; reattach its edges to the bridge room. Bridge room keeps the original name and description. Returns new graph and the bridge node id. */
export function replaceNodeWithDungeon(
  g: GraphData,
  nodeId: string
): { graphData: GraphData; bridgeNodeId: string } {
  const node = g.nodes.find((n) => n.id === nodeId)
  if (!node) return { graphData: g, bridgeNodeId: nodeId }

  const outgoingEdges = g.links.filter(
    (l) => l.source === nodeId || l.target === nodeId
  )

  const sub = generateBiteSizedDungeon()
  const bridgeNodeId = sub.nodes[0].id

  const newNodes: DungeonNode[] = sub.nodes.map((n) => {
    const isBridge = n.id === bridgeNodeId
    return {
      ...n,
      parentNodeId: nodeId,
      entrance: isBridge ? node.entrance : false,
      ...(isBridge
        ? { label: node.label ?? n.label, content: node.content ?? n.content }
        : {}),
    }
  })

  const newLinks: DungeonLink[] = sub.links.map((l) => ({
    ...l,
    source: l.source,
    target: l.target,
  }))

  const nodesWithoutOld = g.nodes.filter((n) => n.id !== nodeId)
  const linksWithoutOld = g.links.filter(
    (l) => l.source !== nodeId && l.target !== nodeId
  )

  const reattachLinks: DungeonLink[] = outgoingEdges.map((oldLink) => {
    const external = oldLink.source === nodeId ? oldLink.target : oldLink.source
    return {
      source: bridgeNodeId,
      target: external,
      connectionType: oldLink.connectionType,
      ...(oldLink.description !== undefined && { description: oldLink.description }),
      ...(oldLink.clueRoomId !== undefined && { clueRoomId: oldLink.clueRoomId }),
    }
  })

  return {
    graphData: {
      nodes: [...nodesWithoutOld, ...newNodes],
      links: [...linksWithoutOld, ...newLinks, ...reattachLinks],
    },
    bridgeNodeId,
  }
}

export interface ConnectionInfo {
  otherNode: DungeonNode
  connectionType: ConnectionType
  description?: string
  clueRoomId?: string
}

export function getConnectionsForNode(
  graphData: GraphData,
  nodeId: string
): ConnectionInfo[] {
  const result: ConnectionInfo[] = []
  for (const link of graphData.links) {
    if (link.source !== nodeId && link.target !== nodeId) continue
    const otherId = link.source === nodeId ? link.target : link.source
    const otherNode = graphData.nodes.find((n) => n.id === otherId)
    if (!otherNode) continue
    result.push({
      otherNode,
      connectionType: link.connectionType,
      description: link.description,
      clueRoomId: link.clueRoomId,
    })
  }
  result.sort((a, b) => (a.otherNode.label || a.otherNode.id).localeCompare(b.otherNode.label || b.otherNode.id))
  return result
}
