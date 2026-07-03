import { Editor, getSnapshot, loadSnapshot } from 'tldraw'
import { MindMapTheme, THEMES, MindNodeProps, MARKER_MAP } from '../mindmap/types'
import { MIND_NODE_TYPE } from '../mindmap/shapes'
import {
  Plus, Minus, Undo2, Redo2, ZoomIn, ZoomOut, Maximize,
  List, Tag, Palette, Settings, Save, FolderOpen, Download, Play, Bot,
} from 'lucide-react'

interface ToolbarProps {
  editor: Editor | null
  rootId: string | null
  selectedId: string | null
  theme: MindMapTheme
  onThemeChange: (t: MindMapTheme) => void
  onTogglePanel: (p: 'outline' | 'markers' | 'properties' | 'theme') => void
  activePanel: string | null
  onPitchMode: () => void
  onToggleAI: () => void
  aiActive: boolean
}

export function Toolbar({ editor, rootId, selectedId, theme, onThemeChange, onTogglePanel, activePanel, onPitchMode, onToggleAI, aiActive }: ToolbarProps) {
  if (!editor) return null

  const selectedShape = selectedId ? editor.getShape(selectedId as any) : null
  const canDelete = selectedShape && selectedShape.type === MIND_NODE_TYPE && (selectedShape.props as unknown as MindNodeProps).level !== 'root'

  const handleAddChild = () => {
    if (!selectedId || !editor) return
    const shape = editor.getShape(selectedId as any)
    if (!shape || shape.type !== MIND_NODE_TYPE) return
    // Simulate Tab key
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
  }

  const handleAddSibling = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  }

  const handleDelete = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
  }

  const handleSave = () => {
    if (!editor) return
    const { document: doc } = getSnapshot(editor.store)
    const data = JSON.stringify(doc, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nexusmind.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoad = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !editor) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const snapshot = JSON.parse(reader.result as string)
          loadSnapshot(editor.store, { document: snapshot })
        } catch (err) { console.error('Load failed:', err) }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleExportPNG = async () => {
    if (!editor) return
    const result = await editor.getSvgString([...editor.getCurrentPageShapeIds()])
    if (!result) return
    const svgStr = result.svg
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1920
      canvas.height = 1080
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = theme.background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((b) => {
        if (!b) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = 'nexusmind.png'
        a.click()
      })
    }
    img.src = url
  }

  const btn = (icon: React.ReactNode, title: string, onClick: () => void, disabled = false, active = false) => (
    <div
      className={`toolbar-btn ${active ? 'active' : ''}`}
      title={title}
      onClick={disabled ? undefined : onClick}
      style={disabled ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
    >
      {icon}
    </div>
  )

  return (
    <div className="nexus-toolbar">
      {btn(<Plus size={16} />, 'Ajouter enfant (Tab)', handleAddChild, !selectedId)}
      {btn(<Minus size={16} />, 'Supprimer (Delete)', handleDelete, !canDelete)}

      <div className="toolbar-sep" />

      {btn(<Undo2 size={16} />, 'Annuler (Ctrl+Z)', () => editor.undo())}
      {btn(<Redo2 size={16} />, 'Rétablir (Ctrl+Y)', () => editor.redo())}

      <div className="toolbar-sep" />

      {btn(<ZoomOut size={16} />, 'Zoom -', () => editor.zoomOut())}
      {btn(<ZoomIn size={16} />, 'Zoom +', () => editor.zoomIn())}
      {btn(<Maximize size={16} />, 'Ajuster', () => editor.zoomToFit())}

      <div className="toolbar-sep" />

      <select
        className="toolbar-select"
        value={theme.name}
        onChange={(e) => {
          const t = Object.values(THEMES).find(t => t.name === e.target.value)
          if (t) onThemeChange(t)
        }}
      >
        {Object.values(THEMES).map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
      </select>

      <div className="toolbar-sep" />

      {btn(<Save size={16} />, 'Sauvegarder', handleSave)}
      {btn(<FolderOpen size={16} />, 'Ouvrir', handleLoad)}
      {btn(<Download size={16} />, 'Exporter PNG', handleExportPNG)}

      <div className="toolbar-sep" />

      {btn(<Bot size={16} />, 'Assistant IA', onToggleAI, false, aiActive)}

      {btn(<Play size={16} />, 'Mode présentation', onPitchMode)}

      <div style={{ flex: 1 }} />

      {btn(<List size={16} />, 'Plan', () => onTogglePanel('outline'), false, activePanel === 'outline')}
      {btn(<Tag size={16} />, 'Marqueurs', () => onTogglePanel('markers'), false, activePanel === 'markers')}
      {btn(<Palette size={16} />, 'Thème', () => onTogglePanel('theme'), false, activePanel === 'theme')}
      {btn(<Settings size={16} />, 'Propriétés', () => onTogglePanel('properties'), false, activePanel === 'properties')}
    </div>
  )
}