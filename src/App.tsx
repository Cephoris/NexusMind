import { useCallback, useEffect, useState } from 'react'
import { Tldraw, Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { MindNodeShapeUtil, MindBranchShapeUtil, MIND_NODE_TYPE } from './mindmap/shapes'
import { BranchOverlay } from './mindmap/BranchOverlay'
import { MindNodeProps, THEMES, MindMapTheme, getDefaultNodeProps } from './mindmap/types'
import { autoLayout } from './mindmap/autoLayout'
import { Toolbar } from './components/Toolbar'
import { SidePanel } from './components/SidePanel'
import { PitchMode } from './components/PitchMode'
import { AIChat } from './components/AIChat'
import './styles.css'

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [rootId, setRootId] = useState<string | null>(null)
  const [theme, setTheme] = useState<MindMapTheme>(THEMES.dark)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'outline' | 'markers' | 'properties' | 'theme' | null>(null)
  const [pitchMode, setPitchMode] = useState(false)
  const [aiChat, setAiChat] = useState(false)

  // Init root node on mount
  const handleMount = useCallback((ed: Editor) => {
    setEditor(ed)
    const rootProps = getDefaultNodeProps('Sujet central', 'root', THEMES.dark)
    const rootShapeId = `shape:${Date.now().toString(36)}-root`

    ed.run(() => {
      ed.createShape({
        id: rootShapeId as any,
        type: MIND_NODE_TYPE,
        x: -80, y: -22,
        rotation: 0, opacity: 1,
        props: rootProps,
        meta: {},
      } as any)
      setRootId(rootShapeId)

      // Two starter branches
      const c1Id = `shape:${Date.now().toString(36)}-c1`
      const c1Props = getDefaultNodeProps('Branche 1', 'main', THEMES.dark, 0, rootShapeId)
      ed.createShape({ id: c1Id as any, type: MIND_NODE_TYPE, x: 200, y: -60, rotation: 0, opacity: 1, props: c1Props, meta: {} } as any)

      const c2Id = `shape:${Date.now().toString(36)}-c2`
      const c2Props = getDefaultNodeProps('Branche 2', 'main', THEMES.dark, 1, rootShapeId)
      ed.createShape({ id: c2Id as any, type: MIND_NODE_TYPE, x: -360, y: -60, rotation: 0, opacity: 1, props: c2Props, meta: {} } as any)

      ed.updateShape({ id: rootShapeId as any, type: MIND_NODE_TYPE, props: { ...rootProps, childIds: [c1Id, c2Id] } } as any)
      autoLayout(ed, rootShapeId)
      ed.select(rootShapeId as any)
      setSelectedId(rootShapeId)
    })
  }, [])

  // Track selection
  useEffect(() => {
    if (!editor) return
    return editor.store.listen(() => {
      const sel = editor.getSelectedShapeIds()
      setSelectedId(sel.length > 0 ? (sel[0] as string) : null)
    }, { source: 'user', scope: 'session' })
  }, [editor])

  // Listen for AI-triggered root change
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) setRootId(detail)
    }
    window.addEventListener('nexusmind-newroot', handler)
    return () => window.removeEventListener('nexusmind-newroot', handler)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    if (!editor) return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      const sel = editor.getSelectedShapeIds()
      if (sel.length === 0) return
      const id = sel[0]
      const shape = editor.getShape(id)
      if (!shape || shape.type !== MIND_NODE_TYPE) return
      const props = shape.props as unknown as MindNodeProps

      if (e.key === 'Tab') { e.preventDefault(); addChild(editor, id as string, props, theme, rootId!) }
      else if (e.key === 'Enter') { e.preventDefault(); addSibling(editor, id as string, props, theme, rootId!) }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && props.level !== 'root') { e.preventDefault(); deleteNode(editor, id as string, props, rootId!) }
      else if (e.key === ' ') { e.preventDefault(); toggleCollapse(editor, id as string, props, rootId!) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editor, theme, rootId])

  // Theme change
  const handleThemeChange = useCallback((t: MindMapTheme) => {
    setTheme(t)
    if (!editor || !rootId) return
    editor.run(() => {
      for (const shape of editor.getCurrentPageShapes().filter(s => s.type === MIND_NODE_TYPE)) {
        const p = shape.props as unknown as MindNodeProps
        const bi = p.level === 'main' ? getBranchIndex(editor, rootId, shape.id as string) : 0
        editor.updateShape({ id: shape.id, type: MIND_NODE_TYPE, props: {
          ...p,
          color: p.level === 'root' ? t.rootColor : p.level === 'main' ? t.mainColors[bi % t.mainColors.length] : t.subColor,
          textColor: p.level === 'root' ? t.rootTextColor : p.level === 'main' ? '#fff' : t.subTextColor,
          branchColor: p.level === 'main' ? t.branchColors[bi % t.branchColors.length] : p.branchColor,
        }} as any)
      }
    })
  }, [editor, rootId])

  return (
    <div className="nexus-app">
      <Toolbar editor={editor} rootId={rootId} selectedId={selectedId} theme={theme}
        onThemeChange={handleThemeChange}
        onTogglePanel={(p) => setActivePanel(activePanel === p ? null : p)}
        activePanel={activePanel}
        onPitchMode={() => setPitchMode(true)}
        onToggleAI={() => setAiChat(!aiChat)}
        aiActive={aiChat} />
      <div className="nexus-main">
        <div className="nexus-canvas-wrapper" style={{ background: theme.background }}>
          <Tldraw shapeUtils={[MindNodeShapeUtil, MindBranchShapeUtil]} onMount={handleMount} />
          {editor && rootId && <BranchOverlay editor={editor} rootId={rootId} />}
        </div>
        {activePanel && editor && rootId && (
          <SidePanel editor={editor} rootId={rootId} selectedId={selectedId}
            activePanel={activePanel} theme={theme} onThemeChange={handleThemeChange}
            onClose={() => setActivePanel(null)} />
        )}
        {aiChat && editor && rootId && (
          <AIChat editor={editor} rootId={rootId} selectedId={selectedId} theme={theme}
            onClose={() => setAiChat(false)} />
        )}
      </div>
      {pitchMode && editor && rootId && (
        <PitchMode editor={editor} rootId={rootId} theme={theme} onExit={() => setPitchMode(false)} />
      )}
    </div>
  )
}

// ========== Helpers ==========

function getBranchIndex(editor: Editor, rootId: string, shapeId: string): number {
  const root = editor.getShape(rootId as any)
  if (!root) return 0
  return (root.props as unknown as MindNodeProps).childIds.indexOf(shapeId)
}

function addChild(editor: Editor, parentId: string, parentProps: MindNodeProps, theme: MindMapTheme, rootId: string) {
  const bi = parentProps.level === 'root' ? parentProps.childIds.length : getBranchIndex(editor, parentProps.parentId || '', parentId)
  const childLevel = parentProps.level === 'root' ? 'main' : 'sub'
  const childProps = getDefaultNodeProps('Nouveau sujet', childLevel, theme, bi, parentId)
  const childId = `shape:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  editor.run(() => {
    editor.createShape({ id: childId as any, type: MIND_NODE_TYPE, x: 200, y: 0, rotation: 0, opacity: 1, props: childProps, meta: {} } as any)
    editor.updateShape({ id: parentId as any, type: MIND_NODE_TYPE, props: { ...parentProps, childIds: [...parentProps.childIds, childId] } } as any)
    autoLayout(editor, rootId)
    editor.select(childId as any)
  })
}

function addSibling(editor: Editor, siblingId: string, sibProps: MindNodeProps, theme: MindMapTheme, rootId: string) {
  if (!sibProps.parentId || sibProps.level === 'root') return
  const parent = editor.getShape(sibProps.parentId as any)
  if (!parent) return
  const parentProps = parent.props as unknown as MindNodeProps
  const bi = getBranchIndex(editor, sibProps.parentId, siblingId)
  const newProps = getDefaultNodeProps('Nouveau sujet', sibProps.level, theme, bi, sibProps.parentId)
  const newId = `shape:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  editor.run(() => {
    editor.createShape({ id: newId as any, type: MIND_NODE_TYPE, x: 0, y: 0, rotation: 0, opacity: 1, props: newProps, meta: {} } as any)
    const idx = parentProps.childIds.indexOf(siblingId)
    const newChildIds = [...parentProps.childIds]
    newChildIds.splice(idx + 1, 0, newId)
    editor.updateShape({ id: sibProps.parentId as any, type: MIND_NODE_TYPE, props: { ...parentProps, childIds: newChildIds } } as any)
    autoLayout(editor, rootId)
    editor.select(newId as any)
  })
}

function deleteNode(editor: Editor, nodeId: string, props: MindNodeProps, rootId: string) {
  editor.run(() => {
    const toDelete: string[] = [nodeId]
    function collect(id: string) {
      const s = editor.getShape(id as any)
      if (!s) return
      const p = s.props as unknown as MindNodeProps
      for (const cid of p.childIds) { toDelete.push(cid); collect(cid) }
    }
    collect(nodeId)
    if (props.parentId) {
      const parent = editor.getShape(props.parentId as any)
      if (parent) {
        const pp = parent.props as unknown as MindNodeProps
        editor.updateShape({ id: props.parentId as any, type: MIND_NODE_TYPE, props: { ...pp, childIds: pp.childIds.filter(i => i !== nodeId) } } as any)
        editor.select(props.parentId as any)
      }
    }
    editor.deleteShapes(toDelete as any[])
    autoLayout(editor, rootId)
  })
}

function toggleCollapse(editor: Editor, nodeId: string, props: MindNodeProps, rootId: string) {
  editor.updateShape({ id: nodeId as any, type: MIND_NODE_TYPE, props: { ...props, collapsed: !props.collapsed } } as any)
  editor.run(() => autoLayout(editor, rootId))
}