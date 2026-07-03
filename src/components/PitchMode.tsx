import { useEffect, useState, useCallback } from 'react'
import { Editor } from 'tldraw'
import { MindNodeProps } from '../mindmap/types'
import { MIND_NODE_TYPE } from '../mindmap/shapes'
import { X, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'

interface PitchModeProps {
  editor: Editor
  rootId: string
  theme: { background: string; rootColor: string; subColor: string; textColor: string }
  onExit: () => void
}

export function PitchMode({ editor, rootId, theme, onExit }: PitchModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Build traversal order (depth-first)
  const allTopics: { id: string; title: string; level: string; color: string; textColor: string }[] = []
  const visited = new Set<string>()

  const collect = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)
    const shape = editor.getShape(id as any)
    if (!shape || shape.type !== MIND_NODE_TYPE) return
    const props = shape.props as unknown as MindNodeProps
    allTopics.push({
      id,
      title: props.title || '...',
      level: props.level,
      color: props.color,
      textColor: props.textColor,
    })
    for (const cid of props.childIds) {
      collect(cid)
    }
  }
  collect(rootId)

  // Navigation
  const navigate = useCallback((dir: 'next' | 'prev') => {
    setCurrentIndex(i => dir === 'next' ? Math.min(i + 1, allTopics.length - 1) : Math.max(i - 1, 0))
  }, [allTopics.length])

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'Enter': e.preventDefault(); navigate('next'); break
        case 'ArrowLeft': case 'Backspace': e.preventDefault(); navigate('prev'); break
        case 'Escape': onExit(); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, onExit])

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentIndex(i => {
        if (i >= allTopics.length - 1) { setIsPlaying(false); return i }
        return i + 1
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [isPlaying, allTopics.length])

  const current = allTopics[currentIndex]
  if (!current) return null

  // Get ancestor path
  const ancestors: typeof allTopics = []
  let curId = current.id
  while (curId) {
    const shape = editor.getShape(curId as any)
    if (!shape) break
    const props = shape.props as unknown as MindNodeProps
    if (props.parentId) {
      const parent = editor.getShape(props.parentId as any)
      if (parent) {
        const pp = parent.props as unknown as MindNodeProps
        ancestors.unshift({ id: parent.id as string, title: pp.title, level: pp.level, color: pp.color, textColor: pp.textColor })
        curId = parent.id as string
      } else break
    } else break
  }

  const visibleIds = new Set([...ancestors.map(a => a.id), current.id])

  return (
    <div className="pitch-mode" style={{ background: theme.background }}>
      {/* Content */}
      <div style={{ width: '90%', maxWidth: 1000, padding: 40 }}>
        {/* Breadcrumb path */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, opacity: 0.5, fontSize: 14 }}>
          {ancestors.map((a, i) => (
            <span key={a.id} style={{ color: a.textColor }}>
              {a.title}
              {i < ancestors.length - 1 && ' › '}
            </span>
          ))}
        </div>

        {/* Current topic */}
        <div style={{
          display: 'inline-block',
          padding: '16px 40px',
          borderRadius: current.level === 'root' ? 30 : 16,
          background: current.color,
          color: current.textColor,
          fontSize: current.level === 'root' ? 36 : current.level === 'main' ? 28 : 22,
          fontWeight: current.level === 'root' ? 800 : 600,
          boxShadow: `0 0 40px ${current.color}55`,
          marginBottom: 24,
        }}>
          {current.title}
        </div>

        {/* Children preview */}
        {(() => {
          const shape = editor.getShape(current.id as any)
          if (!shape) return null
          const props = shape.props as unknown as MindNodeProps
          if (props.collapsed || props.childIds.length === 0) return null
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
              {props.childIds.map(cid => {
                const child = editor.getShape(cid as any)
                if (!child) return null
                const cp = child.props as unknown as MindNodeProps
                return (
                  <div key={cid} style={{
                    padding: '8px 20px',
                    borderRadius: 12,
                    background: cp.color,
                    color: cp.textColor,
                    fontSize: 16,
                    fontWeight: 400,
                    opacity: 0.7,
                  }}>
                    {cp.title || '...'}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Controls */}
      <div className="pitch-controls">
        <div className="toolbar-btn" onClick={() => navigate('prev')}><ChevronLeft size={20} /></div>
        <div className="toolbar-btn" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </div>
        <div className="toolbar-btn" onClick={() => navigate('next')}><ChevronRight size={20} /></div>
        <div style={{ width: 1, height: 20, background: '#333', margin: '0 4px' }} />
        <span style={{ fontSize: 14, color: '#888' }}>{currentIndex + 1} / {allTopics.length}</span>
        <div className="toolbar-btn" onClick={onExit}><X size={20} /></div>
      </div>
    </div>
  )
}