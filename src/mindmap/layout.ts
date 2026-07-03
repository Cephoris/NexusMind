import { Editor, TLShape, TLShapeId } from 'tldraw'
import { MindNodeProps, NodeLevel } from './types'

// ========== Layout Engine ==========

const H_GAP = 200   // horizontal gap between levels
const V_GAP = 50    // vertical gap between siblings
const NODE_WIDTH = 160
const NODE_HEIGHT = 44

interface LayoutNode {
  id: string
  level: number
  children: LayoutNode[]
  subtreeHeight: number
  side: 'left' | 'right' | 'center'
}

export function computeLayout(
  editor: Editor,
  rootId: string,
): Map<string, { x: number; y: number; width: number; height: number }> {
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>()

  // Build tree structure from tldraw shapes
  const shapes = editor.getCurrentPageShapes()
  const nodeShapes = shapes.filter(s => s.type === 'mindnode')
  const nodeMap = new Map<string, TLShape>()
  for (const s of nodeShapes) {
    nodeMap.set(s.id, s)
  }

  // Build parent->children mapping from props
  const childrenMap = new Map<string, string[]>()
  for (const s of nodeShapes) {
    const props = s.props as unknown as MindNodeProps
    if (props.parentId) {
      const siblings = childrenMap.get(props.parentId) || []
      siblings.push(s.id)
      childrenMap.set(props.parentId, siblings)
    }
  }

  // Build layout tree
  function buildNode(id: string, level: number): LayoutNode | null {
    const shape = nodeMap.get(id)
    if (!shape) return null
    const props = shape.props as unknown as MindNodeProps
    const childIds = props.collapsed ? [] : (childrenMap.get(id) || [])
    const children = childIds.map(cid => buildNode(cid, level + 1)).filter(Boolean) as LayoutNode[]
    return {
      id,
      level,
      children,
      subtreeHeight: 0,
      side: 'center',
    }
  }

  const root = buildNode(rootId, 0)
  if (!root) return positions

  // Layout: root at center, children split left/right
  function layout(node: LayoutNode): number {
    if (node.children.length === 0) {
      node.subtreeHeight = NODE_HEIGHT
      return NODE_HEIGHT
    }

    let totalH = 0
    for (const child of node.children) {
      totalH += layout(child)
    }
    totalH += (node.children.length - 1) * V_GAP
    node.subtreeHeight = Math.max(NODE_HEIGHT, totalH)
    return node.subtreeHeight
  }

  layout(root)

  // Assign positions: mind map style (root center, children left/right)
  function assignPositions(node: LayoutNode, x: number, y: number, side: 'left' | 'right' | 'center') {
    positions.set(node.id, { x, y, width: NODE_WIDTH, height: NODE_HEIGHT })

    if (node.children.length === 0) return

    const mid = Math.ceil(node.children.length / 2)
    const rightChildren = node.children.slice(0, mid)
    const leftChildren = node.children.slice(mid)

    // Right side
    let rightY = y - (rightChildren.reduce((s, c) => s + c.subtreeHeight, 0) + (rightChildren.length - 1) * V_GAP) / 2
    for (const child of rightChildren) {
      const childY = rightY + child.subtreeHeight / 2
      const childX = node.level === 0 ? x + NODE_WIDTH / 2 + H_GAP : x + NODE_WIDTH / 2 + H_GAP
      assignPositions(child, childX, childY, node.level === 0 ? 'right' : side)
      rightY += child.subtreeHeight + V_GAP
    }

    // Left side
    let leftY = y - (leftChildren.reduce((s, c) => s + c.subtreeHeight, 0) + (leftChildren.length - 1) * V_GAP) / 2
    for (const child of leftChildren) {
      const childY = leftY + child.subtreeHeight / 2
      const childX = node.level === 0 ? x - NODE_WIDTH / 2 - H_GAP : x - NODE_WIDTH / 2 - H_GAP
      assignPositions(child, childX, childY, node.level === 0 ? 'left' : side)
      leftY += child.subtreeHeight + V_GAP
    }
  }

  assignPositions(root, 0, 0, 'center')

  return positions
}

// ========== Branch Path Generation ==========

export function getBranchPath(
  from: { x: number; y: number; w: number; h: number; side: 'left' | 'right' | 'center' },
  to: { x: number; y: number; w: number; h: number; side: 'left' | 'right' | 'center' },
): string {
  const fromX = from.side === 'left' ? from.x - from.w / 2 : from.side === 'right' ? from.x + from.w / 2 : from.x
  const fromY = from.y
  const toX = to.side === 'left' ? to.x + to.w / 2 : to.side === 'right' ? to.x - to.w / 2 : to.x
  const toY = to.y

  const dx = Math.abs(toX - fromX)
  const offset = dx * 0.4
  const cp1x = fromX + (toX > fromX ? offset : -offset)
  const cp1y = fromY
  const cp2x = toX + (fromX > toX ? offset : -offset)
  const cp2y = toY

  return `M ${fromX} ${fromY} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${toX} ${toY}`
}

// ========== Get bounds of all nodes ==========

export function getAllBounds(
  positions: Map<string, { x: number; y: number; width: number; height: number }>,
): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x - pos.width / 2)
    maxX = Math.max(maxX, pos.x + pos.width / 2)
    minY = Math.min(minY, pos.y - pos.height / 2)
    maxY = Math.max(maxY, pos.y + pos.height / 2)
  }
  if (minX === Infinity) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  return { minX, maxX, minY, maxY }
}