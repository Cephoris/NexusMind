import { useEffect, useRef } from 'react'
import { Editor } from 'tldraw'
import { MindNodeProps } from './types'
import { getBranchPath } from './layout'

// ========== Branch Overlay ==========
// Renders curved branch lines between mind map nodes as SVG overlay.
// Uses direct editor store listening instead of useValue (which needs Tldraw context).

export function BranchOverlay({ editor, rootId }: { editor: Editor; rootId: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)

  useEffect(() => {
    // Listen to store changes and redraw branches
    const update = () => {
      const g = gRef.current
      if (!g) return

      const shapes = editor.getCurrentPageShapes()
      const camera = editor.getCamera()

      // Update SVG transform
      g.setAttribute('transform', `translate(${camera.x}, ${camera.y}) scale(${camera.z})`)

      const nodeShapes = shapes.filter(s => s.type === 'mindnode')

      // Build parent->children map
      const childrenMap = new Map<string, string[]>()
      for (const s of nodeShapes) {
        const props = s.props as unknown as MindNodeProps
        if (props.parentId) {
          const siblings = childrenMap.get(props.parentId) || []
          siblings.push(s.id)
          childrenMap.set(props.parentId, siblings)
        }
      }

      // Determine side (left/right/center) for each node
      const sideMap = new Map<string, 'left' | 'right' | 'center'>()
      const root = nodeShapes.find(s => s.id === rootId)
      if (root) {
        const rootX = root.x
        sideMap.set(rootId, 'center')
        const walk = (id: string, side: 'left' | 'right' | 'center') => {
          const children = childrenMap.get(id) || []
          for (const childId of children) {
            const child = nodeShapes.find(s => s.id === childId)
            if (!child) continue
            let childSide = side
            if (id === rootId) {
              childSide = child.x + 80 > rootX + 80 ? 'right' : 'left'
            }
            sideMap.set(childId, childSide)
            walk(childId, childSide)
          }
        }
        walk(rootId, 'center')
      }

      // Generate branch paths
      g.innerHTML = ''

      for (const s of nodeShapes) {
        const props = s.props as unknown as MindNodeProps
        if (!props.parentId) continue

        const parent = nodeShapes.find(ns => ns.id === props.parentId)
        if (!parent) continue

        const parentSide = sideMap.get(props.parentId) || 'center'
        const childSide = sideMap.get(s.id) || parentSide

        const from = {
          x: parent.x + 80,
          y: parent.y + 22,
          w: 160,
          h: 44,
          side: parentSide,
        }
        const to = {
          x: s.x + 80,
          y: s.y + 22,
          w: 160,
          h: 44,
          side: childSide,
        }

        const path = getBranchPath(from, to)
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        pathEl.setAttribute('d', path)
        pathEl.setAttribute('fill', 'none')
        pathEl.setAttribute('stroke', props.branchColor || '#4a4a6c')
        pathEl.setAttribute('stroke-width', props.level === 'main' ? '3' : props.level === 'sub' ? '2' : '1.5')
        pathEl.setAttribute('stroke-linecap', 'round')
        pathEl.style.pointerEvents = 'none'
        g.appendChild(pathEl)
      }
    }

    // Initial draw
    update()

    // Listen to all store changes
    const dispose = editor.store.listen(update, { source: 'user', scope: 'document' })
    const dispose2 = editor.store.listen(update, { source: 'user', scope: 'session' })

    return () => {
      dispose()
      dispose2()
    }
  }, [editor, rootId])

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <g ref={gRef} />
    </svg>
  )
}