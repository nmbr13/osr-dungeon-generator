import { useRef, useEffect, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { GraphData, ConnectionType } from '../types'

const LINK_DISTANCE = 28
const BRIDGE_LINK_DISTANCE = 10
const BRIDGE_LINK_STRENGTH = 1
const NON_BRIDGE_LINK_STRENGTH = 0.55
const CHARGE_STRENGTH = -400
const TREE_LINK_DISTANCE = 22
const TREE_CHARGE_STRENGTH = -90
const TREE_LEVEL_DISTANCE = 38

const CONNECTION_LABELS: Record<string, string> = {
  open: 'Open',
  closed: 'Closed',
  trapped: 'Trap',
  hazardous: 'Hazard',
  secret: 'Secret',
}

export type GraphLayoutMode = 'force' | 'tree'

export type Theme = 'light' | 'dark' | 'monochrome'

const GRAPH_COLORS: Record<
  Theme,
  {
    bg: string
    roomType: Record<string, string>
    selectedStroke: string
    label: string
    entranceStroke: string
    linkDefault: string
    linkTrap: string
    linkLabel: string
  }
> = {
  dark: {
    bg: '#1a1b26',
    roomType: { monster_treasure: '#f7768e', monster: '#ff9e64', treasure: '#e0af68', special: '#bb9af7', empty: '#7dcfff' },
    selectedStroke: '#c0caf5',
    label: '#c0caf5',
    entranceStroke: '#e0af68',
    linkDefault: '#565f89',
    linkTrap: '#f7768e',
    linkLabel: '#a9b1d6',
  },
  light: {
    bg: '#f0f1f5',
    roomType: { monster_treasure: '#a01d35', monster: '#b84a1a', treasure: '#8b6914', special: '#5c3d7a', empty: '#0d6a9e' },
    selectedStroke: '#1a5fb4',
    label: '#0f1116',
    entranceStroke: '#8b6914',
    linkDefault: '#3d4252',
    linkTrap: '#a01d35',
    linkLabel: '#3d4252',
  },
  monochrome: {
    bg: '#ffffff',
    roomType: { monster_treasure: '#606060', monster: '#505050', treasure: '#404040', special: '#707070', empty: '#505050' },
    selectedStroke: '#404040',
    label: '#404040',
    entranceStroke: '#505050',
    linkDefault: '#606060',
    linkTrap: '#505050',
    linkLabel: '#505050',
  },
}

interface DungeonGraphProps {
  graphData: GraphData
  selectedNodeId: string | null
  selectedEdge: { source: string; target: string } | null
  onSelectNode: (id: string | null) => void
  onSelectEdge: (edge: { source: string; target: string } | null) => void
  onUpdateEdge: (
    source: string,
    target: string,
    updates: Partial<{ connectionType: ConnectionType; description: string; clueRoomId: string }>
  ) => void
  layoutMode?: GraphLayoutMode
  theme?: Theme
}

/** Link is a bridge if removing it would disconnect the graph. */
function getBridgeLinkKeys(
  nodeIds: Set<string>,
  links: { source: string; target: string }[]
): Set<string> {
  const key = (a: string, b: string) => [a, b].sort().join('-')
  const bridgeKeys = new Set<string>()
  const normLinks = links.map((l) => ({
    s: typeof l.source === 'string' ? l.source : (l.source as { id: string }).id,
    t: typeof l.target === 'string' ? l.target : (l.target as { id: string }).id,
  }))
  normLinks.forEach(({ s, t }) => {
    const adj = new Map<string, string[]>()
    nodeIds.forEach((id) => adj.set(id, []))
    normLinks.forEach((e) => {
      if ((e.s === s && e.t === t) || (e.s === t && e.t === s)) return
      adj.get(e.s)!.push(e.t)
      adj.get(e.t)!.push(e.s)
    })
    const visited = new Set<string>()
    const queue = [s]
    visited.add(s)
    while (queue.length) {
      const id = queue.shift()!
      for (const nid of adj.get(id) ?? []) {
        if (!visited.has(nid)) {
          visited.add(nid)
          queue.push(nid)
        }
      }
    }
    if (!visited.has(t)) bridgeKeys.add(key(s, t))
  })
  return bridgeKeys
}

/** Multi-source BFS: all entranceIds at depth 0, others get min distance from any entrance. */
function getDepthsFromEntrances(
  nodeIds: Set<string>,
  links: { source: string; target: string }[],
  entranceIds: string[]
): Map<string, number> {
  const depths = new Map<string, number>()
  const adj = new Map<string, string[]>()
  nodeIds.forEach((id) => adj.set(id, []))
  links.forEach((l) => {
    const s = typeof l.source === 'string' ? l.source : (l.source as { id: string }).id
    const t = typeof l.target === 'string' ? l.target : (l.target as { id: string }).id
    adj.get(s)!.push(t)
    adj.get(t)!.push(s)
  })
  const roots = entranceIds.length > 0 ? entranceIds : Array.from(nodeIds).slice(0, 1)
  roots.forEach((id) => depths.set(id, 0))
  let frontier = [...roots]
  while (frontier.length) {
    const next: string[] = []
    for (const id of frontier) {
      const d = depths.get(id)! + 1
      for (const nid of adj.get(id)!) {
        if (!depths.has(nid)) {
          depths.set(nid, d)
          next.push(nid)
        }
      }
    }
    frontier = next
  }
  return depths
}

export function DungeonGraph({
  graphData,
  selectedNodeId,
  selectedEdge,
  onSelectNode,
  onSelectEdge,
  layoutMode = 'force',
  theme = 'dark',
}: DungeonGraphProps) {
  const colors = GRAPH_COLORS[theme]
  const fgRef = useRef<{
    d3Force: (name: string, fn?: unknown) => unknown
    d3ReheatSimulation: () => void
  } | null>(null)

  const isTree = layoutMode === 'tree'
  const entranceIds = useMemo(
    () => graphData.nodes.filter((n) => n.entrance).map((n) => n.id),
    [graphData.nodes]
  )

  const bridgeLinkKeys = useMemo(() => {
    if (isTree) return new Set<string>()
    const nodeIds = new Set(graphData.nodes.map((n) => n.id))
    return getBridgeLinkKeys(
      nodeIds,
      graphData.links.map((l) => ({ source: l.source, target: l.target }))
    )
  }, [graphData.nodes, graphData.links, isTree])

  const graphDataForForce = useMemo(() => {
    const nodeIds = new Set(graphData.nodes.map((n) => n.id))
    const nodes = graphData.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      roomType: n.roomType,
      entrance: n.entrance,
    }))
    let links = graphData.links.map((l) => ({
      source: l.source,
      target: l.target,
      connectionType: l.connectionType,
      clueRoomId: l.clueRoomId,
    }))
    if (isTree && nodeIds.size > 0) {
      const depths = getDepthsFromEntrances(
        nodeIds,
        graphData.links.map((l) => ({ source: l.source, target: l.target })),
        entranceIds
      )
      links = graphData.links.map((l) => {
        const s = l.source
        const t = l.target
        const dS = depths.get(s) ?? 0
        const dT = depths.get(t) ?? 0
        const source = dS < dT ? s : dT < dS ? t : s < t ? s : t
        const target = source === s ? t : s
        const link = graphData.links.find(
          (e) =>
            (e.source === l.source && e.target === l.target) || (e.source === l.target && e.target === l.source)
        )!
        return {
          source,
          target,
          connectionType: link.connectionType,
          clueRoomId: link.clueRoomId,
        }
      })
    }
    return { nodes, links }
  }, [graphData, isTree, entranceIds])

  useEffect(() => {
    const fg = fgRef.current
    if (!fg || graphData.nodes.length === 0) return
    const linkForce = fg.d3Force('link') as {
      distance?: (d: number | ((link: { source: { id: string }; target: { id: string } }) => number)) => void
      strength?: (s: number | ((link: { source: { id: string }; target: { id: string } }) => number)) => void
    } | undefined
    const chargeForce = fg.d3Force('charge') as { strength?: (s: number) => void } | undefined
    if (linkForce) {
      if (isTree) {
        if (linkForce.distance) linkForce.distance(TREE_LINK_DISTANCE)
      } else {
        const keys = bridgeLinkKeys
        const linkKey = (link: { source: { id: string } | string; target: { id: string } | string }) => {
          const a = typeof link.source === 'object' && link.source && 'id' in link.source ? link.source.id : link.source
          const b = typeof link.target === 'object' && link.target && 'id' in link.target ? link.target.id : link.target
          return a && b ? [String(a), String(b)].sort().join('-') : ''
        }
        if (linkForce.distance) {
          linkForce.distance((link) => (keys.has(linkKey(link)) ? BRIDGE_LINK_DISTANCE : LINK_DISTANCE))
        }
        if (linkForce.strength) {
          linkForce.strength((link) => (keys.has(linkKey(link)) ? BRIDGE_LINK_STRENGTH : NON_BRIDGE_LINK_STRENGTH))
        }
      }
    }
    if (chargeForce?.strength) chargeForce.strength(isTree ? TREE_CHARGE_STRENGTH : CHARGE_STRENGTH)
    fg.d3ReheatSimulation()
  }, [graphData, isTree, bridgeLinkKeys])

  const norm = (a: string, b: string) => [a, b].sort().join('-')
  const selectedKey =
    selectedEdge && norm(selectedEdge.source, selectedEdge.target)

  return (
    <ForceGraph2D
      ref={fgRef as never}
      graphData={graphDataForForce}
      backgroundColor={colors.bg}
      dagMode={isTree ? 'td' : undefined}
      dagLevelDistance={isTree ? TREE_LEVEL_DISTANCE : undefined}
      nodeId="id"
      nodeLabel={(n: { id: string; label?: string }) => n.label || n.id}
      nodeCanvasObject={(node, ctx, globalScale) => {
        const id = (node as { id: string }).id
        const label = (node as { label?: string }).label || id
        const isSelected = id === selectedNodeId
        const isEntrance = (node as { entrance?: boolean }).entrance
        const roomType = (node as { roomType?: string }).roomType || 'empty'
        const fill = colors.roomType[roomType] ?? colors.roomType.empty

        const radius = 6 + (label.length > 8 ? 2 : 0)
        const halfSize = radius

        if (isEntrance) {
          ctx.beginPath()
          ctx.rect(node.x! - halfSize, node.y! - halfSize, halfSize * 2, halfSize * 2)
          ctx.fillStyle = isSelected ? colors.selectedStroke : fill
          ctx.fill()
          if (isSelected) {
            ctx.strokeStyle = colors.selectedStroke
            ctx.lineWidth = 2
            ctx.stroke()
          }
          ctx.strokeStyle = colors.entranceStroke
          ctx.setLineDash([4, 2])
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.setLineDash([])
        } else {
          ctx.beginPath()
          ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI)
          ctx.fillStyle = isSelected ? colors.selectedStroke : fill
          ctx.fill()
          if (isSelected) {
            ctx.strokeStyle = colors.selectedStroke
            ctx.lineWidth = 2
            ctx.stroke()
          }
        }

        const fontSize = 10 / globalScale
        const iconSize = 22 / globalScale
        ctx.font = `${iconSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const hasMonster = roomType === 'monster' || roomType === 'monster_treasure'
        const hasTreasure = roomType === 'treasure' || roomType === 'monster_treasure'
        const iconY = node.y! - radius - iconSize * 0.5
        if (hasMonster && hasTreasure) {
          ctx.fillText('\u{1F480}', node.x! - iconSize * 0.45, iconY)
          ctx.fillText('\u{1F4B0}', node.x! + iconSize * 0.45, iconY)
        } else if (hasMonster) {
          ctx.fillText('\u{1F480}', node.x!, iconY)
        } else if (hasTreasure) {
          ctx.fillText('\u{1F4B0}', node.x!, iconY)
        }

        ctx.font = `${fontSize}px sans-serif`
        ctx.fillStyle = colors.label
        ctx.fillText(label, node.x!, node.y! + radius + fontSize)
      }}
      linkSource="source"
      linkTarget="target"
      linkCanvasObject={(link, ctx, globalScale) => {
        const source = link.source as { x: number; y: number }
        const target = link.target as { x: number; y: number }
        const connectionType = (link as { connectionType?: string }).connectionType ?? 'open'
        const isSecret = connectionType === 'secret'
        const isTrapOrHazard = connectionType === 'trapped' || connectionType === 'hazardous'
        const key = norm(
          (link.source as { id: string }).id,
          (link.target as { id: string }).id
        )
        const isSelected = key === selectedKey

        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        if (isSecret) {
          ctx.setLineDash([4, 3])
        }
        const baseColor = isTrapOrHazard ? colors.linkTrap : colors.linkDefault
        ctx.strokeStyle = isSelected ? colors.selectedStroke : baseColor
        ctx.lineWidth = isSelected ? 3 : 1.5
        ctx.stroke()
        if (isSecret) {
          ctx.setLineDash([])
        }

        const midX = (source.x + target.x) / 2
        const midY = (source.y + target.y) / 2
        const lbl = CONNECTION_LABELS[connectionType] ?? connectionType
        const fontSize = 8 / globalScale
        ctx.font = `${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = colors.linkLabel
        ctx.fillText(lbl, midX, midY)
      }}
      onNodeClick={(node) => {
        const id = (node as { id: string }).id
        onSelectNode(selectedNodeId === id ? null : id)
        onSelectEdge(null)
      }}
      onLinkClick={(link) => {
        const source = (link.source as { id: string }).id
        const target = (link.target as { id: string }).id
        onSelectEdge({ source, target })
        onSelectNode(null)
      }}
      onBackgroundClick={() => {
        onSelectNode(null)
        onSelectEdge(null)
      }}
    />
  )
}

