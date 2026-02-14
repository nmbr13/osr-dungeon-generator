import { useState, useRef, useEffect } from 'react'
import { RoomEditor } from './components/RoomEditor'
import { DungeonGraph } from './components/DungeonGraph'
import type { GraphData, ConnectionType } from './types'
import type { Theme } from './components/DungeonGraph'
import { generateBiteSizedDungeon } from './lib/biteSizedGenerator'
import { attachDungeon, replaceNodeWithDungeon, updateNode, updateEdge, addEdge } from './lib/graphUtils'
import { buildMarkdown, downloadMarkdown, downloadImage, DEFAULT_IMAGE_FILENAME } from './lib/exportMarkdown'
import './App.css'

function App() {
  const [graphData, setGraphData] = useState<GraphData>(() => generateBiteSizedDungeon())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<{ source: string; target: string } | null>(null)
  const [graphLayout, setGraphLayout] = useState<'force' | 'tree'>('force')
  const [theme, setTheme] = useState<Theme>('dark')
  const graphContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const handleAttachDungeon = (nodeId: string) => {
    setGraphData((g) => attachDungeon(g, nodeId))
    setSelectedNodeId(null)
  }

  const handleReplaceWithDungeon = (nodeId: string) => {
    const { graphData: next, bridgeNodeId } = replaceNodeWithDungeon(graphData, nodeId)
    setGraphData(next)
    setSelectedNodeId(bridgeNodeId)
  }

  const handleUpdateNode = (nodeId: string, updates: Partial<{ label: string; content: string; entrance: boolean }>) => {
    setGraphData((g) => updateNode(g, nodeId, updates))
  }

  const handleUpdateEdge = (
    source: string,
    target: string,
    updates: Partial<{ connectionType: ConnectionType; description: string; clueRoomId: string }>
  ) => {
    setGraphData((g) => updateEdge(g, source, target, updates))
  }

  const handleAddEdge = (source: string, target: string, connectionType: ConnectionType) => {
    setGraphData((g) => addEdge(g, source, target, connectionType))
  }

  const handleNewDungeon = () => {
    setGraphData(generateBiteSizedDungeon())
    setSelectedNodeId(null)
    setSelectedEdge(null)
  }

  const getExportCanvas = (): HTMLCanvasElement | null => {
    const container = graphContainerRef.current
    const canvases = container?.querySelectorAll('canvas') ?? []
    for (let i = 0; i < canvases.length; i++) {
      const c = canvases[i] as HTMLCanvasElement
      if (c.width > 0 && c.height > 0) return c
    }
    return canvases.length > 0 ? (canvases[0] as HTMLCanvasElement) : null
  }

  const handleExportImage = () => {
    const canvas = getExportCanvas()
    if (canvas) {
      downloadImage(canvas.toDataURL('image/png'), DEFAULT_IMAGE_FILENAME)
    }
  }

  const handleExportMarkdown = () => {
    const canvas = getExportCanvas()
    const title = 'Bite-Sized Dungeon'
    const md = buildMarkdown(graphData, title, canvas ? DEFAULT_IMAGE_FILENAME : null)
    downloadMarkdown(md, 'dungeon.md')
  }

  return (
    <div className="app">
      <div className="panel-left">
        <header className="panel-header">
          <h1>Bite-Sized Dungeon</h1>
          <div className="header-actions">
            <select
              className="theme-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              aria-label="Theme"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="monochrome">Monochrome</option>
            </select>
            <button type="button" className="btn btn-secondary" onClick={handleExportImage}>
              Export image
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleExportMarkdown}>
              Export markdown
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleNewDungeon}>
              New dungeon
            </button>
          </div>
        </header>
        <RoomEditor
          graphData={graphData}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onUpdateNode={handleUpdateNode}
          onAttachDungeon={handleAttachDungeon}
          onReplaceWithDungeon={handleReplaceWithDungeon}
          onAddEdge={handleAddEdge}
        />
      </div>
      <div className="panel-right">
        <div className="graph-toolbar">
          <span className="graph-toolbar-label">Layout:</span>
          <button
            type="button"
            className={`btn btn-small ${graphLayout === 'force' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setGraphLayout('force')}
          >
            Force
          </button>
          <button
            type="button"
            className={`btn btn-small ${graphLayout === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setGraphLayout('tree')}
          >
            Tree
          </button>
        </div>
        <div className="graph-area" ref={graphContainerRef}>
          <DungeonGraph
            graphData={graphData}
            selectedNodeId={selectedNodeId}
            selectedEdge={selectedEdge}
            onSelectNode={setSelectedNodeId}
            onSelectEdge={setSelectedEdge}
            onUpdateEdge={handleUpdateEdge}
            layoutMode={graphLayout}
            theme={theme}
          />
        </div>
        {selectedEdge && (() => {
          const link = graphData.links.find(
            (l) =>
              (l.source === selectedEdge.source && l.target === selectedEdge.target) ||
              (l.source === selectedEdge.target && l.target === selectedEdge.source)
          )
          return (
            <EdgeEditor
              source={selectedEdge.source}
              target={selectedEdge.target}
              connectionType={link?.connectionType ?? 'open'}
              description={link?.description ?? ''}
              clueRoomId={link?.clueRoomId ?? ''}
              nodes={graphData.nodes}
              sourceLabel={graphData.nodes.find((n) => n.id === selectedEdge.source)?.label || selectedEdge.source}
              targetLabel={graphData.nodes.find((n) => n.id === selectedEdge.target)?.label || selectedEdge.target}
              onUpdate={handleUpdateEdge}
              onClose={() => setSelectedEdge(null)}
            />
          )
        })()}
      </div>
    </div>
  )
}

function EdgeEditor({
  source,
  target,
  connectionType,
  description,
  clueRoomId,
  nodes,
  sourceLabel,
  targetLabel,
  onUpdate,
  onClose,
}: {
  source: string
  target: string
  connectionType: ConnectionType
  description: string
  clueRoomId: string
  nodes: GraphData['nodes']
  sourceLabel: string
  targetLabel: string
  onUpdate: (s: string, t: string, u: Partial<{ connectionType: ConnectionType; description: string; clueRoomId: string }>) => void
  onClose: () => void
}) {
  const [editingDescription, setEditingDescription] = useState(description)
  useEffect(() => {
    setEditingDescription(description)
  }, [source, target, description])

  const types: ConnectionType[] = ['open', 'closed', 'trapped', 'hazardous', 'secret']
  const adjoiningRoomIds = [source, target]
  const clueRoomOptions = nodes.filter((n) => adjoiningRoomIds.includes(n.id))

  return (
    <div className="edge-editor-overlay">
      <div className="edge-editor">
        <h3>Connection: {sourceLabel} – {targetLabel}</h3>
        <div className="edge-types">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              className={`btn ${connectionType === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onUpdate(source, target, { connectionType: t })}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {connectionType === 'secret' && (
          <>
            <label className="edge-editor-label">Clue found in (adjoining room)</label>
            <select
              className="edge-editor-select"
              value={clueRoomId}
              onChange={(e) => onUpdate(source, target, { clueRoomId: e.target.value })}
            >
              <option value="">— Select room —</option>
              {clueRoomOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label || n.id}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="edge-editor-label">Description</label>
        <textarea
          className="edge-editor-description"
          value={editingDescription}
          onChange={(e) => setEditingDescription(e.target.value)}
          onBlur={() => onUpdate(source, target, { description: editingDescription })}
          placeholder="Corridor or door description..."
          rows={3}
        />
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

export default App
