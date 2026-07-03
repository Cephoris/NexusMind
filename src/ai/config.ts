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
  model: 'llama3.2',
  systemPrompt: `Tu es un assistant spécialisé dans la création de cartes mentales (mind maps).
L'utilisateur te demande de créer ou modifier une carte mentale.
Tu dois répondre avec un objet JSON valide décrivant la carte mentale.

Format JSON attendu:
{
  "action": "create" | "modify" | "add" | "delete" | "restructure",
  "nodes": [
    {
      "title": "Titre du nœud",
      "children": [
        { "title": "Sous-nœud", "children": [...] }
      ]
    }
  ],
  "instructions": "Description optionnelle de ce que tu as fait"
}

Pour "create": génère toute la carte depuis zéro.
Pour "add": ajoute des nœuds enfants au nœud sélectionné.
Pour "modify": modifie la structure existante.
Pour "delete": indique quels nœuds supprimer (par titre).
Pour "restructure": réorganise la hiérarchie.

Garde les titres courts (2-5 mots). Sois structuré et logique.
Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`,
  temperature: 0.7,
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
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && config.apiKey !== 'ollama'
        ? { 'Authorization': `Bearer ${config.apiKey}` }
        : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        ...messages,
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Erreur API (${response.status}): ${errText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ========== Fetch available models ==========

export async function fetchModels(config: AIConfig): Promise<string[]> {
  try {
    // Try OpenAI-compatible /models endpoint
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
  // Try to extract JSON from the response
  // The AI might wrap it in markdown code blocks or add extra text
  let jsonStr = text.trim()

  // Remove markdown code blocks
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  // Try to find JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonStr = jsonMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonStr)
    if (parsed && parsed.nodes) {
      return parsed as AIResponse
    }
  } catch {
    // Try to fix common JSON issues
    try {
      // Remove trailing commas
      jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
      const parsed = JSON.parse(jsonStr)
      if (parsed && parsed.nodes) {
        return parsed as AIResponse
      }
    } catch {
      console.error('Failed to parse AI response:', jsonStr)
    }
  }

  return null
}