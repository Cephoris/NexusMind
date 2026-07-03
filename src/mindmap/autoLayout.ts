import { Editor } from 'tldraw'
import { MindNodeProps } from './types'

// ========== Auto-Layout Engine ==========
// After each structural change (add/delete/move), recompute positions for all nodes.

const NODE_W = 160
const NODE_H = 44
const H_GAP = 80    // horizontal gap between parent and children
const V_GAP = 12    // vertical gap between siblings

interface LayoutNode {
  id: string
  children: LayoutNode[]
  subtreeHeight: number
  side: 'left' | 'right' | 'center'
}

function buildLayoutTree(editor: Editor, rootId: string): LayoutNode | null {
  const shape = editor.getShape(rootId as any)
  if (!shape) return null
  const props = shape.props as unknown as MindNodeProps
  const childIds = props.collapsed ? [] : props.childIds
  const children = childIds.map(cid => buildLayoutTree(editor, cid)).filter(Boolean) as LayoutNode[]
  return { id: rootId, children, subtreeHeight: 0, side: 'center' }
}

function computeSubtreeHeights(node: LayoutNode): number {
  if (node.children.length === 0) {
    node.subtreeHeight = NODE_H
    return NODE_H
  }
  let total = 0
  for (const child of node.children) {
    total += computeSubtreeHeights(child)
  }
  total += (node.children.length - 1) * V_GAP
  node.subtreeHeight = Math.max(NODE_H, total)
  return node.subtreeHeight
}

function assignPositions(
  editor: Editor,
  node: LayoutNode,
  x: number,
  y: number,
  side: 'left' | 'right' | 'center',
) {
  // Update shape position
  const shape = editor.getShape(node.id as any)
  if (shape) {
    editor.updateShape({
      id: node.id as any,
      type: 'mindnode',
      x: x - NODE_W / 2,
      y: y - NODE_H / 2,
    } as any)
  }

  if (node.children.length === 0) return

  // Determine if this node's children go left or right
  // Root node: split children left/right
  // Other nodes: continue on the same side
  if (side === 'center') {
    // Split children: right half and left half
    const mid = Math.ceil(node.children.length / 2)
    const rightChildren = node.children.slice(0, mid)
    const leftChildren = node.children.slice(mid)

    // Right side
    const rightTotal = rightChildren.reduce((s, c) => s + c.subtreeHeight, 0) + Math.max(0, rightChildren.length - 1) * V_GAP
    let ry = y - rightTotal / 2
    for (const child of rightChildren) {
      const childY = ry + child.subtreeHeight / 2
      const childX = x + NODE_W / 2 + H_GAP
      assignPositions(editor, child, childX, childY, 'right')
      ry += child.subtreeHeight + V_GAP
    }

    // Left side
    const leftTotal = leftChildren.reduce((s, c) => s + c.subtreeHeight, 0) + Math.max(0, leftChildren.length - 1) * V_GAP
    let ly = y - leftTotal / 2
    for (const child of leftChildren) {
      const childY = ly + child.subtreeHeight / 2
      const childX = x - NODE_W / 2 - H_GAP
      assignPositions(editor, child, childX, childY, 'left')
      ly += child.subtreeHeight + V_GAP
    }
  } else {
    // All children on same side
    const total = node.children.reduce((s, c) => s + c.subtreeHeight, 0) + (node.children.length - 1) * V_GAP
    let cy = y - total / 2
    const childX = side === 'right' ? x + NODE_W / 2 + H_GAP : x - NODE_W / 2 - H_GAP
    for (const child of node.children) {
      const childY = cy + child.subtreeHeight / 2
      assignPositions(editor, child, childX, childY, side)
      cy += child.subtreeHeight + V_GAP
    }
  }
}

// ========== Public API ==========

export function autoLayout(editor: Editor, rootId: string) {
  const root = buildLayoutTree(editor, rootId)
  if (!root) return

  computeSubtreeHeights(root)
  assignPositions(editor, root, 0, 0, 'center')
}