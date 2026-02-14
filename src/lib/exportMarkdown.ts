import type { GraphData } from '../types'
import { getConnectionsForNode } from './graphUtils'

const CONNECTION_TYPE_LABELS: Record<string, string> = {
  open: 'open',
  closed: 'closed',
  trapped: 'trapped',
  hazardous: 'hazardous',
  secret: 'secret',
}

export const DEFAULT_IMAGE_FILENAME = 'dungeon.png'

export function buildMarkdown(
  graphData: GraphData,
  title: string,
  imageRef: string | null
): string {
  const lines: string[] = []
  lines.push(`# ${title}\n`)
  if (imageRef) {
    lines.push('## Dungeon map\n')
    lines.push(`![Dungeon map](${imageRef})\n`)
  }
  lines.push('## Rooms\n')

  const entranceFirst = [...graphData.nodes].sort((a, b) => {
    if (a.entrance && !b.entrance) return -1
    if (!a.entrance && b.entrance) return 1
    return (a.label || a.id).localeCompare(b.label || b.id)
  })

  const labelCount = new Map<string, number>()
  for (const node of entranceFirst) {
    const baseLabel = node.label || node.id
    const count = (labelCount.get(baseLabel) ?? 0) + 1
    labelCount.set(baseLabel, count)
    const heading = count === 1 ? baseLabel : `${baseLabel} (${count})`
    lines.push(`### ${heading}`)
    if (node.entrance) lines.push('*Entrance*')
    lines.push('')
    lines.push(node.content || '*No description.*')
    const connections = getConnectionsForNode(graphData, node.id)
    if (connections.length > 0) {
      lines.push('')
      lines.push('**Exits**')
      for (const conn of connections) {
        const typeLabel = CONNECTION_TYPE_LABELS[conn.connectionType] ?? conn.connectionType
        const otherName = conn.otherNode.label || conn.otherNode.id
        const cluePart =
          conn.connectionType === 'secret' && conn.clueRoomId
            ? graphData.nodes.find((n) => n.id === conn.clueRoomId)
            : null
        const clueName = cluePart ? ` (clue in: ${cluePart.label || cluePart.id})` : ''
        if (conn.description) {
          lines.push(`- **To ${otherName} (${typeLabel}${clueName}):** ${conn.description}`)
        } else {
          lines.push(`- **To ${otherName}** (${typeLabel}${clueName})`)
        }
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadImage(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}
