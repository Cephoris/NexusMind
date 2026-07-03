import { HTMLContainer, Rectangle2d, ShapeUtil, TLBaseShape } from 'tldraw'
import { MindNodeProps } from './types'
import { MARKER_MAP } from './types'

// ========== Shape Type Definitions ==========

export const MIND_NODE_TYPE = 'mindnode' as const
export const MIND_BRANCH_TYPE = 'mindbranch' as const

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [MIND_NODE_TYPE]: MindNodeProps
    [MIND_BRANCH_TYPE]: {
      fromId: string
      toId: string
      color: string
      strokeWidth: number
    }
  }
}

export type MindNodeShape = TLBaseShape<typeof MIND_NODE_TYPE, MindNodeProps>
export type MindBranchShape = TLBaseShape<typeof MIND_BRANCH_TYPE, {
  fromId: string
  toId: string
  color: string
  strokeWidth: number
}>

// ========== MindNode ShapeUtil ==========

export class MindNodeShapeUtil extends ShapeUtil<MindNodeShape> {
  static override type = MIND_NODE_TYPE as any

  override getDefaultProps(): MindNodeShape['props'] {
    return {
      title: 'Nouveau sujet',
      level: 'sub',
      color: '#2a2a4e',
      textColor: '#eee',
      fontSize: 13,
      fontWeight: 400,
      branchColor: '#4a4a6c',
      markers: [],
      note: '',
      collapsed: false,
      parentId: null,
      childIds: [],
    }
  }

  override getGeometry(shape: MindNodeShape) {
    return new Rectangle2d({
      width: 160,
      height: 44,
      isFilled: true,
    })
  }

  override component(shape: MindNodeShape) {
    const { title, color, textColor, fontSize, fontWeight, markers, note, collapsed, level } = shape.props
    const borderRadius = level === 'root' ? 22 : level === 'main' ? 16 : 12

    return (
      <HTMLContainer
        style={{
          width: 160,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: color,
          borderRadius,
          border: level === 'root' ? `3px solid ${textColor}33` : 'none',
          color: textColor,
          fontSize,
          fontWeight,
          fontFamily: 'Inter, -apple-system, sans-serif',
          padding: '0 16px',
          textAlign: 'center',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          boxShadow: level === 'root' ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
          pointerEvents: 'all',
          position: 'relative',
          cursor: 'default',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {title || '...'}
        </span>

        {markers.length > 0 && (
          <div style={{ position: 'absolute', top: -10, right: -4, display: 'flex', gap: 1, fontSize: 12 }}>
            {markers.slice(0, 4).map(mid => {
              const m = MARKER_MAP[mid]
              return m ? <span key={mid}>{m.icon}</span> : null
            })}
          </div>
        )}

        {note && (
          <div style={{ position: 'absolute', bottom: -8, right: 2, fontSize: 10, opacity: 0.7 }}>📝</div>
        )}

        {collapsed && shape.props.childIds.length > 0 && (
          <div style={{
            position: 'absolute', right: -16, top: '50%', transform: 'translateY(-50%)',
            width: 18, height: 18, borderRadius: 9, background: shape.props.branchColor,
            color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>
            {shape.props.childIds.length}
          </div>
        )}
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: MindNodeShape) {
    const path = new Path2D()
    const r = shape.props.level === 'root' ? 22 : 12
    path.roundRect(0, 0, 160, 44, r)
    return path
  }

  override canEdit(): boolean { return true }
  override canResize(): boolean { return false }
  override hideRotateHandle(): boolean { return true }
}

// ========== MindBranch ShapeUtil (not used as shape, branches drawn in overlay) ==========

export class MindBranchShapeUtil extends ShapeUtil<MindBranchShape> {
  static override type = MIND_BRANCH_TYPE as any

  override getDefaultProps(): MindBranchShape['props'] {
    return { fromId: '', toId: '', color: '#4a4a6c', strokeWidth: 2 }
  }

  override getGeometry(shape: MindBranchShape) {
    return new Rectangle2d({ width: 1, height: 1, isFilled: false })
  }

  override component(shape: MindBranchShape) {
    return <HTMLContainer style={{ width: 1, height: 1, pointerEvents: 'none' }} />
  }

  override getIndicatorPath(shape: MindBranchShape) { return new Path2D() }
  override canEdit(): boolean { return false }
  override canResize(): boolean { return false }
  override hideRotateHandle(): boolean { return true }
}