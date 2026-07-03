import { Editor } from 'tldraw'
import { MindMapTheme, THEMES, MindNodeProps, MARKERS, MARKER_MAP } from '../mindmap/types'
import { MIND_NODE_TYPE } from '../mindmap/shapes'
import { X, ChevronDown, ChevronRight, StickyNote, Link as LinkIcon } from 'lucide-react'
import { useState } from 'react'

interface SidePanelProps {
  editor: Editor
  rootId: string
  selectedId: string | null
  activePanel: 'outline' | 'markers' | 'properties' | 'theme'
  theme: MindMapTheme
  onThemeChange: (t: MindMapTheme) => void
  onClose: () => void
}

export function SidePanel({ editor, rootId, selectedId, activePanel, theme, onThemeChange, onClose }: SidePanelProps) {
  return (
    <div className="nexus-panel">
      <div className="panel-header">
        <span>{activePanel === 'outline' ? 'Plan' : activePanel === 'markers' ? 'Marqueurs' : activePanel === 'theme' ? 'Thème' : 'Propriétés'}</span>
        <div className="toolbar-btn" onClick={onClose}><X size={16} /></div>
      </div>
      <div className="panel-content">
        {activePanel === 'outline' && <OutlineView editor={editor} rootId={rootId} selectedId={selectedId} />}
        {activePanel === 'markers' && <MarkersView editor={editor} selectedId={selectedId} />}
        {activePanel === 'properties' && <PropertiesView editor={editor} selectedId={selectedId} />}
        {activePanel === 'theme' && <ThemeView theme={theme} onThemeChange={onThemeChange} />}
      </div>
    </div>
  )
}

function OutlineView({ editor, rootId, selectedId }: { editor: Editor; rootId: string; selectedId: string | null }) {
  const renderNode = (id: string, depth: number): React.ReactNode => {
    const shape = editor.getShape(id as any)
    if (!shape) return null
    const props = shape.props as unknown as MindNodeProps
    const isSel = selectedId === id

    return (
      <div key={id}>
        <div
          className={`outline-item ${isSel ? 'selected' : ''}`}
          style={{ paddingLeft: depth * 16 + 8 }}
          onClick={() => { editor.select(id as any); editor.zoomToSelection() }}
        >
          <span onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: id as any, type: MIND_NODE_TYPE, props: { ...props, collapsed: !props.collapsed } } as any) }} style={{ cursor: 'pointer', display: 'inline-flex' }}>
            {props.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
          <span style={{
            fontWeight: props.level === 'root' ? 700 : props.level === 'main' ? 600 : 400,
            fontSize: props.level === 'root' ? 15 : 13,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {props.title || '...'}
          </span>
          {props.markers.length > 0 && <span style={{ marginLeft: 4 }}>{props.markers.map(m => MARKER_MAP[m]?.icon).join('')}</span>}
        </div>
        {!props.collapsed && props.childIds.map(cid => renderNode(cid, depth + 1))}
      </div>
    )
  }
  return <div>{renderNode(rootId, 0)}</div>
}

function MarkersView({ editor, selectedId }: { editor: Editor; selectedId: string | null }) {
  if (!selectedId) return <p className="panel-hint">Sélectionnez un sujet</p>
  const shape = editor.getShape(selectedId as any)
  if (!shape || shape.type !== MIND_NODE_TYPE) return <p className="panel-hint">Sélectionnez un nœud</p>
  const props = shape.props as unknown as MindNodeProps

  const toggle = (mid: string) => {
    const has = props.markers.includes(mid)
    const markers = has ? props.markers.filter(m => m !== mid) : [...props.markers, mid]
    editor.updateShape({ id: selectedId as any, type: MIND_NODE_TYPE, props: { ...props, markers } } as any)
  }

  return (
    <div>
      <div className="marker-grid">
        {MARKERS.map(m => (
          <div key={m.id} className="marker-item" title={m.name} onClick={() => toggle(m.id)}
            style={{ background: props.markers.includes(m.id) ? 'var(--nexus-primary)' : 'transparent', border: props.markers.includes(m.id) ? '1px solid var(--nexus-accent)' : '1px solid transparent' }}>
            {m.icon}
          </div>
        ))}
      </div>
    </div>
  )
}

function PropertiesView({ editor, selectedId }: { editor: Editor; selectedId: string | null }) {
  const [, forceUpdate] = useState(0)
  if (!selectedId) return <p className="panel-hint">Sélectionnez un sujet</p>
  const shape = editor.getShape(selectedId as any)
  if (!shape || shape.type !== MIND_NODE_TYPE) return <p className="panel-hint">Sélectionnez un nœud</p>
  const props = shape.props as unknown as MindNodeProps

  const update = (changes: Partial<MindNodeProps>) => {
    editor.updateShape({ id: selectedId as any, type: MIND_NODE_TYPE, props: { ...props, ...changes } } as any)
    forceUpdate(v => v + 1)
  }

  return (
    <div className="props-container">
      <label className="prop-label">Titre</label>
      <input className="prop-input" value={props.title} onChange={e => update({ title: e.target.value })} />

      <label className="prop-label">Couleur de fond</label>
      <input type="color" className="prop-color" value={props.color} onChange={e => update({ color: e.target.value })} />

      <label className="prop-label">Couleur du texte</label>
      <input type="color" className="prop-color" value={props.textColor} onChange={e => update({ textColor: e.target.value })} />

      <label className="prop-label">Taille de police: {props.fontSize}px</label>
      <input type="range" min={10} max={28} value={props.fontSize} onChange={e => update({ fontSize: parseInt(e.target.value) })} />

      <div className="prop-divider" />

      <label className="prop-label"><StickyNote size={14} style={{ display: 'inline', marginRight: 4 }} />Note</label>
      <textarea className="prop-textarea" value={props.note} onChange={e => update({ note: e.target.value })} placeholder="Ajouter une note..." />
    </div>
  )
}

function ThemeView({ theme, onThemeChange }: { theme: MindMapTheme; onThemeChange: (t: MindMapTheme) => void }) {
  return (
    <div>
      {Object.values(THEMES).map(t => (
        <div key={t.name} onClick={() => onThemeChange(t)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderRadius: 6, cursor: 'pointer', marginBottom: 4, background: theme.name === t.name ? 'var(--nexus-primary)' : 'transparent' }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {t.mainColors.slice(0, 4).map((c, i) => <div key={i} style={{ width: 16, height: 16, borderRadius: 4, background: c }} />)}
          </div>
          <span style={{ fontSize: 13 }}>{t.name}</span>
        </div>
      ))}
    </div>
  )
}