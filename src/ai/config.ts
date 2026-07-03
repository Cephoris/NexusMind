// ========== AI Configuration ==========

export interface AIConfig {
  baseUrl: string       // e.g. http://localhost:11434/v1 for Ollama
  apiKey: string         // optional, 'ollama' for Ollama
  model: string          // e.g. llama3.2, qwen2.5, etc.
  systemPrompt: string   // system prompt for the AI
  temperature: number
  maxTokens: number
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'ollama',
  model: 'qwen3-coder-next:cloud',
  systemPrompt: `Tu es un générateur de cartes mentales. Tu réponds UNIQUEMENT avec du JSON valide, sans aucun texte avant ou après.

Quand l'utilisateur demande de créer une carte, réponds avec ce format EXACT:

{"action":"create","nodes":[{"title":"Sujet central","children":[{"title":"Branche 1","children":[{"title":"Sous-nœud A"},{"title":"Sous-nœud B"}]},{"title":"Branche 2","children":[{"title":"Détail 1"},{"title":"Détail 2"}]}],"instructions":"Description brève"}

Règles:
- "action" est "create", "add", "modify", "delete" ou "restructure"
- "nodes" contient la hiérarchie des nœuds (title + children optionnel)
- Pour "add": les nœuds seront ajoutés au nœud sélectionné
- Pour "delete": ajoute "deleteTitles":["titre1","titre2"]
- Titres courts: 2-5 mots maximum
- PAS de texte avant ou après le JSON
- PAS de markdown, PAS de backticks, JUSTE le JSON`,
  temperature: 0.3,
  maxTokens: 4096,
}

// ========== AI Chat Messages ==========

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

// ========== Call AI API ==========

export async function callAI(
  config: AIConfig,
  messages: { role: string; content: string }[],
): Promise<string> {
  const body: any = {
    model: config.model,
    messages: [
      { role: 'system', content: config.systemPrompt },
      ...messages,
    ],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && config.apiKey !== 'ollama'
        ? { 'Authorization': `Bearer ${config.apiKey}` }
        : {}),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    // If response_format was the issue, retry without it
    if (response.status === 400) {
      delete body.response_format
      const retry = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && config.apiKey !== 'ollama'
            ? { 'Authorization': `Bearer ${config.apiKey}` }
            : {}),
        },
        body: JSON.stringify(body),
      })
      if (retry.ok) {
        const data = await retry.json()
        return data.choices?.[0]?.message?.content || ''
      }
    }
    const errText = await response.text()
    throw new Error(`Erreur API (${response.status}): ${errText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ========== Fetch available models ==========

export async function fetchModels(config: AIConfig): Promise<string[]> {
  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: {
        ...(config.apiKey && config.apiKey !== 'ollama'
          ? { 'Authorization': `Bearer ${config.apiKey}` }
          : {}),
      },
    })
    if (!response.ok) return []
    const data = await response.json()
    return data.data?.map((m: any) => m.id) || []
  } catch {
    return []
  }
}

// ========== Parse AI response to mind map structure ==========

export interface AINode {
  title: string
  children?: AINode[]
  color?: string
}

export interface AIResponse {
  action: 'create' | 'modify' | 'add' | 'delete' | 'restructure'
  nodes: AINode[]
  instructions?: string
  deleteTitles?: string[]
}

export function parseAIResponse(text: string): AIResponse | null {
  if (!text || !text.trim()) return null

  let jsonStr = text.trim()

  // Step 1: Remove markdown code blocks (```json ... ``` or ``` ... ```)
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  // Step 2: Try direct parse
  try {
    const parsed = JSON.parse(jsonStr)
    console.log('[NexusMind Parser] Direct parse OK, normalizing...')
    const result = normalizeResponse(parsed)
    console.log('[NexusMind Parser] Normalized result:', result ? 'OK' : 'NULL')
    return result
  } catch(e) {
    console.log('[NexusMind Parser] Direct parse failed:', (e as Error).message)
  }

  // Step 3: Extract the largest JSON object from the text
  // Find the first { and the last matching }
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const extracted = jsonStr.slice(firstBrace, lastBrace + 1)
    try {
      const parsed = JSON.parse(extracted)
      return normalizeResponse(parsed)
    } catch { /* continue */ }
  }

  // Step 4: Try fixing common JSON issues
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    let fixed = jsonStr.slice(firstBrace, lastBrace + 1)
    // Remove trailing commas before } or ]
    fixed = fixed.replace(/,\s*([}\]])/g, '$1')
    // Remove comments
    fixed = fixed.replace(/\/\/.*$/gm, '')
    fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '')
    try {
      const parsed = JSON.parse(fixed)
      return normalizeResponse(parsed)
    } catch { /* continue */ }
  }

  // Step 5: Try to find a JSON array format
  const firstBracket = jsonStr.indexOf('[')
  const lastBracket = jsonStr.lastIndexOf(']')
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const extracted = jsonStr.slice(firstBracket, lastBracket + 1)
    try {
      const arr = JSON.parse(extracted)
      if (Array.isArray(arr)) {
        // Wrap array in expected format
        return normalizeResponse({ action: 'create', nodes: arr })
      }
    } catch { /* continue */ }
  }

  // Step 6: Last resort — try to build structure from plain text (bullet points)
  if (text.includes('\n') && (text.includes('-') || text.includes('*') || text.includes('•'))) {
    const tree = parsePlainTextTree(text)
    if (tree.length > 0) {
      return { action: 'create', nodes: tree }
    }
  }

  console.error('Failed to parse AI response:', text.slice(0, 500))
  return null
}

function normalizeResponse(parsed: any): AIResponse | null {
  if (!parsed) return null

  // Handle different action field values
  let action = parsed.action || 'create'
  if (!['create', 'modify', 'add', 'delete', 'restructure'].includes(action)) {
    action = 'create'
  }

  // Extract nodes — could be under "nodes", "mindmap", "tree", "map", or directly an array
  let nodes = parsed.nodes || parsed.mindmap || parsed.tree || parsed.map || []
  if (!Array.isArray(nodes) && typeof nodes === 'object') {
    // Single root node as object
    nodes = [nodes]
  }
  if (!Array.isArray(nodes) || nodes.length === 0) return null

  // Normalize each node
  nodes = nodes.map((n: any) => normalizeNode(n))

  return {
    action: action as AIResponse['action'],
    nodes,
    instructions: parsed.instructions || parsed.description || parsed.explanation,
    deleteTitles: parsed.deleteTitles || parsed.delete || [],
  }
}

function normalizeNode(n: any): AINode {
  if (typeof n === 'string') {
    return { title: n }
  }
  if (!n || typeof n !== 'object') {
    return { title: 'Sans titre' }
  }

  // Handle different title field names
  const title = n.title || n.name || n.label || n.text || n.topic || 'Sans titre'

  // Handle children under different names
  let children = n.children || n.subtopics || n.sub || n.items || n.branches
  if (children) {
    if (!Array.isArray(children) && typeof children === 'object') {
      children = [children]
    }
    if (Array.isArray(children)) {
      children = children.map((c: any) => normalizeNode(c))
    } else {
      children = undefined
    }
  }

  return {
    title: String(title),
    children: children as AINode[] | undefined,
    color: n.color || n.backgroundColor,
  }
}

// Parse plain text bullet-point tree (fallback for models that don't output JSON)
function parsePlainTextTree(text: string): AINode[] {
  const lines = text.split('\n').filter(l => l.trim())
  const root: AINode = { title: 'Sujet' }
  const stack: { node: AINode; indent: number }[] = [{ node: root, indent: -1 }]

  for (const line of lines) {
    // Calculate indent level
    const indent = line.length - line.trimStart().length
    // Clean the line: remove bullet markers
    const cleaned = line.trim().replace(/^[-*•●▪◦\d+\.\)]+\s*/, '')

    if (!cleaned) continue

    const node: AINode = { title: cleaned }

    // Find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]
    if (!parent.node.children) parent.node.children = []
    parent.node.children.push(node)
    stack.push({ node, indent })
  }

  // Return root's children, or root itself if no children
  if (root.children && root.children.length > 0) {
    // If only one top-level child, use it as root
    if (root.children.length === 1) {
      return root.children
    }
    return root.children
  }

  return []
}