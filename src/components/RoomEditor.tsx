import { useState, useEffect } from 'react'
import type { GraphData, ConnectionType } from '../types'
import { getConnectionsForNode } from '../lib/graphUtils'

const CONNECTION_TYPE_LABELS: Record<string, string> = {
  open: 'Open',
  closed: 'Closed',
  trapped: 'Trapped',
  hazardous: 'Hazardous',
  secret: 'Secret',
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  monster_treasure: 'Monster + Treasure',
  monster: 'Monster',
  treasure: 'Treasure',
  special: 'Special',
  empty: 'Empty',
}

interface RoomEditorProps {
  graphData: GraphData
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
  onUpdateNode: (
    nodeId: string,
    updates: Partial<{ label: string; content: string; entrance: boolean }>
  ) => void
  onAttachDungeon: (nodeId: string) => void
  onReplaceWithDungeon: (nodeId: string) => void
  onAddEdge: (source: string, target: string, connectionType: ConnectionType) => void
}

export function RoomEditor({
  graphData,
  selectedNodeId,
  onSelectNode,
  onUpdateNode,
  onAttachDungeon,
  onReplaceWithDungeon,
  onAddEdge,
}: RoomEditorProps) {
  const [addEdgeSource, setAddEdgeSource] = useState<string>('')
  const [addEdgeTarget, setAddEdgeTarget] = useState<string>('')
  const [addEdgeType, setAddEdgeType] = useState<ConnectionType>('open')

  const selectedNode = selectedNodeId
    ? graphData.nodes.find((n) => n.id === selectedNodeId)
    : null

  const [editingLabel, setEditingLabel] = useState('')
  const [editingContent, setEditingContent] = useState('')

  useEffect(() => {
    if (selectedNode) {
      setEditingLabel(selectedNode.label ?? '')
      setEditingContent(selectedNode.content ?? '')
    }
  }, [selectedNode?.id, selectedNode?.label, selectedNode?.content])

  const handleSubmitAddEdge = () => {
    if (addEdgeSource && addEdgeTarget && addEdgeSource !== addEdgeTarget) {
      onAddEdge(addEdgeSource, addEdgeTarget, addEdgeType)
      setAddEdgeSource('')
      setAddEdgeTarget('')
    }
  }

  return (
    <div className="room-editor">
      <div className="room-list">
        {graphData.nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className={`room-list-item ${selectedNodeId === node.id ? 'selected' : ''}`}
            onClick={() => onSelectNode(node.id)}
          >
            <span className="room-list-label">{node.label || node.id}</span>
            <span className={`room-type-badge room-type-${node.roomType}`}>
              {ROOM_TYPE_LABELS[node.roomType] ?? node.roomType}
            </span>
          </button>
        ))}
      </div>

      {selectedNode && (
        <div className="room-detail">
          <div className="room-detail-header">
            <input
              type="text"
              className="room-name-input"
              value={editingLabel}
              onChange={(e) => setEditingLabel(e.target.value)}
              onBlur={() => onUpdateNode(selectedNode.id, { label: editingLabel })}
              placeholder="Room name"
            />
            <label className="entrance-checkbox">
              <input
                type="checkbox"
                checked={selectedNode.entrance ?? false}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, { entrance: e.target.checked })
                }
              />
              Entrance
            </label>
          </div>
          <textarea
            className="room-content-input"
            value={editingContent}
            onChange={(e) => setEditingContent(e.target.value)}
            onBlur={() => onUpdateNode(selectedNode.id, { content: editingContent })}
            placeholder="Room description (markdown)"
            rows={12}
          />
          <div className="room-connections">
            <h4 className="room-connections-title">Exits / connections</h4>
            {getConnectionsForNode(graphData, selectedNode.id).length === 0 ? (
              <p className="room-connections-empty">No connections.</p>
            ) : (
              <ul className="room-connections-list">
                {getConnectionsForNode(graphData, selectedNode.id).map((conn, i) => {
                  const clueRoom = conn.clueRoomId
                    ? graphData.nodes.find((n) => n.id === conn.clueRoomId)
                    : null
                  return (
                    <li key={i} className="room-connection-item">
                      <strong>To {conn.otherNode.label || conn.otherNode.id}</strong>
                      {' '}
                      ({CONNECTION_TYPE_LABELS[conn.connectionType] ?? conn.connectionType})
                      {conn.connectionType === 'secret' && clueRoom && (
                        <span className="room-connection-clue"> — Clue in: {clueRoom.label || clueRoom.id}</span>
                      )}
                      {conn.description ? (
                        <span className="room-connection-desc"> — {conn.description}</span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="room-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onAttachDungeon(selectedNode.id)}
            >
              Attach 6-room dungeon
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onReplaceWithDungeon(selectedNode.id)}
            >
              Explode into 6-room dungeon
            </button>
          </div>
        </div>
      )}

      <div className="add-edge-section">
        <h3 className="add-edge-title">Add connection</h3>
        <div className="add-edge-row">
          <select
            value={addEdgeSource}
            onChange={(e) => setAddEdgeSource(e.target.value)}
            className="add-edge-select"
          >
            <option value="">From room</option>
            {graphData.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label || n.id}
              </option>
            ))}
          </select>
          <select
            value={addEdgeTarget}
            onChange={(e) => setAddEdgeTarget(e.target.value)}
            className="add-edge-select"
          >
            <option value="">To room</option>
            {graphData.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label || n.id}
              </option>
            ))}
          </select>
        </div>
        <div className="add-edge-row">
          <select
            value={addEdgeType}
            onChange={(e) =>
              setAddEdgeType(e.target.value as ConnectionType)
            }
            className="add-edge-select"
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="trapped">Trapped</option>
            <option value="hazardous">Hazardous</option>
            <option value="secret">Secret</option>
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSubmitAddEdge}
            disabled={!addEdgeSource || !addEdgeTarget || addEdgeSource === addEdgeTarget}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
