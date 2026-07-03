// ========== Mind Map Types ==========

export type NodeLevel = 'root' | 'main' | 'sub' | 'floating'

export interface MindNodeProps {
  title: string
  level: NodeLevel
  color: string        // background color
  textColor: string
  fontSize: number
  fontWeight: number
  branchColor: string  // color of the branch connecting to parent
  markers: string[]    // marker ids
  note: string
  collapsed: boolean
  parentId: string | null  // parent shape id in tldraw
  childIds: string[]       // children shape ids
}

export interface MindBranchProps {
  fromId: string  // parent node id
  toId: string    // child node id
  color: string
  strokeWidth: number
}

// ========== Themes ==========

export interface MindMapTheme {
  name: string
  background: string
  rootColor: string
  rootTextColor: string
  mainColors: string[]
  subColor: string
  subTextColor: string
  branchColors: string[]
  textColor: string
}

export const THEMES: Record<string, MindMapTheme> = {
  dark: {
    name: 'Dark',
    background: '#1a1a2e',
    rootColor: '#e94560',
    rootTextColor: '#ffffff',
    mainColors: ['#e94560', '#0f3460', '#533483', '#1a73e8', '#00a878', '#f6416c'],
    subColor: '#2a2a4e',
    subTextColor: '#eee',
    branchColors: ['#e94560', '#0f3460', '#533483', '#1a73e8', '#00a878', '#f6416c'],
    textColor: '#eee',
  },
  light: {
    name: 'Light',
    background: '#f5f5f5',
    rootColor: '#4285f4',
    rootTextColor: '#ffffff',
    mainColors: ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6'],
    subColor: '#e8e8e8',
    subTextColor: '#333',
    branchColors: ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6'],
    textColor: '#333',
  },
  midnight: {
    name: 'Midnight',
    background: '#0d1117',
    rootColor: '#58a6ff',
    rootTextColor: '#0d1117',
    mainColors: ['#58a6ff', '#f778ba', '#7ee787', '#ffa657', '#d2a8ff', '#ff7b72'],
    subColor: '#21262d',
    subTextColor: '#c9d1d9',
    branchColors: ['#58a6ff', '#f778ba', '#7ee787', '#ffa657', '#d2a8ff', '#ff7b72'],
    textColor: '#c9d1d9',
  },
  forest: {
    name: 'Forest',
    background: '#1b2a1f',
    rootColor: '#52b788',
    rootTextColor: '#0d1f12',
    mainColors: ['#52b788', '#d4a373', '#e09f3e', '#a7c957', '#6a994e', '#bc4749'],
    subColor: '#2d3b2e',
    subTextColor: '#dde5d5',
    branchColors: ['#52b788', '#d4a373', '#e09f3e', '#a7c957', '#6a994e', '#bc4749'],
    textColor: '#dde5d5',
  },
  sunset: {
    name: 'Sunset',
    background: '#2d1b3d',
    rootColor: '#ff6b6b',
    rootTextColor: '#1a0a2e',
    mainColors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9a76', '#c08497'],
    subColor: '#3d2b4d',
    subTextColor: '#f0e6ff',
    branchColors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9a76', '#c08497'],
    textColor: '#f0e6ff',
  },
  classic: {
    name: 'Classic',
    background: '#ffffff',
    rootColor: '#1a73e8',
    rootTextColor: '#ffffff',
    mainColors: ['#1a73e8', '#e8710a', '#d93025', '#188038', '#9334e6', '#c5221f'],
    subColor: '#f0f4f8',
    subTextColor: '#202124',
    branchColors: ['#1a73e8', '#e8710a', '#d93025', '#188038', '#9334e6', '#c5221f'],
    textColor: '#202124',
  },
}

// ========== Markers ==========

export interface Marker {
  id: string
  icon: string
  name: string
}

export const MARKERS: Marker[] = [
  { id: 'p1', icon: '🔴', name: 'Priorité 1' },
  { id: 'p2', icon: '🟡', name: 'Priorité 2' },
  { id: 'p3', icon: '🔵', name: 'Priorité 3' },
  { id: 'p4', icon: '🟢', name: 'Priorité 4' },
  { id: 'flag', icon: '🚩', name: 'Drapeau' },
  { id: 'star', icon: '⭐', name: 'Étoile' },
  { id: 'heart', icon: '❤️', name: 'Cœur' },
  { id: 'check', icon: '✅', name: 'Fait' },
  { id: 'cross', icon: '❌', name: 'Annulé' },
  { id: 'question', icon: '❓', name: 'Question' },
  { id: 'warning', icon: '⚠️', name: 'Attention' },
  { id: 'idea', icon: '💡', name: 'Idée' },
  { id: 'fire', icon: '🔥', name: 'Brûlant' },
  { id: 'bookmark', icon: '📌', name: 'Marque-page' },
  { id: 'lock', icon: '🔒', name: 'Verrouillé' },
  { id: 'people', icon: '👥', name: 'Personnes' },
  { id: 'clock', icon: '⏰', name: 'Horloge' },
  { id: 'calendar', icon: '📅', name: 'Calendrier' },
  { id: 'target', icon: '🎯', name: 'Objectif' },
  { id: 'rocket', icon: '🚀', name: 'Lancement' },
]

export const MARKER_MAP: Record<string, Marker> = MARKERS.reduce<Record<string, Marker>>((acc, m) => {
  acc[m.id] = m
  return acc
}, {})

// ========== Utilities ==========

export function genId(): string {
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function getThemeColor(theme: MindMapTheme, level: NodeLevel, branchIndex: number = 0): string {
  if (level === 'root') return theme.rootColor
  if (level === 'main') return theme.mainColors[branchIndex % theme.mainColors.length]
  return theme.subColor
}

export function getBranchColor(theme: MindMapTheme, branchIndex: number = 0): string {
  return theme.branchColors[branchIndex % theme.branchColors.length]
}

export function getDefaultNodeProps(
  title: string,
  level: NodeLevel,
  theme: MindMapTheme,
  branchIndex: number = 0,
  parentId: string | null = null,
): MindNodeProps {
  return {
    title,
    level,
    color: level === 'root' ? theme.rootColor : level === 'main' ? theme.mainColors[branchIndex % theme.mainColors.length] : theme.subColor,
    textColor: level === 'root' ? theme.rootTextColor : level === 'main' ? '#ffffff' : theme.subTextColor,
    fontSize: level === 'root' ? 18 : level === 'main' ? 15 : 13,
    fontWeight: level === 'root' ? 700 : level === 'main' ? 600 : 400,
    branchColor: level === 'main' ? theme.branchColors[branchIndex % theme.branchColors.length] : theme.branchColors[0],
    markers: [],
    note: '',
    collapsed: false,
    parentId,
    childIds: [],
  }
}