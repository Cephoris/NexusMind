import { useState, useRef, useEffect } from 'react'
import { Editor } from 'tldraw'
import { MIND_NODE_TYPE } from '../mindmap/shapes'
import { MindNodeProps, THEMES, MindMapTheme, getDefaultNodeProps } from '../mindmap/types'
import { autoLayout } from '../mindmap/autoLayout'
import { AIConfig, ChatMessage, callAI, fetchModels, parseAIResponse, AINode, AIResponse } from '../ai/config'
import { X, Send, Settings, Bot, User, Loader, ChevronDown } from 'lucide-react'

interface AIChatProps {
  editor: Editor
  rootId: string
  selectedId: string | null
  theme: MindMapTheme
  onClose: () => void
}

export function AIChat({ editor, rootId, selectedId, theme, onClose }: AIChatProps) {
  const [config, setConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('nexusmind-ai-config')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Migrate old configs
        if (parsed.model === 'llama3.2') {
          parsed.model = 'qwen3-coder-next:cloud'
          parsed.temperature = 0.3
        }
        // Always update systemPrompt to latest version
        parsed.systemPrompt = `Tu es un générateur de cartes mentales. Tu réponds UNIQUEMENT avec du JSON valide, sans aucun texte avant ou après.

Quand l'utilisateur demande de créer une carte, réponds avec ce format EXACT:

{"action":"create","nodes":[{"title":"Sujet central","children":[{"title":"Branche 1","children":[{"title":"Sous-nœud A"},{"title":"Sous-nœud B"}]},{"title":"Branche 2","children":[{"title":"Détail 1"},{"title":"Détail 2"}]}],"instructions":"Description brève"}

Règles:
- "action" est "create", "add", "modify", "delete" ou "restructure"
- "nodes" contient la hiérarchie des nœuds (title + children optionnel)
- Pour "add": les nœuds seront ajoutés au nœud sélectionné
- Pour "delete": ajoute "deleteTitles":["titre1","titre2"]
- Titres courts: 2-5 mots maximum
- PAS de texte avant ou après le JSON
- PAS de markdown, PAS de backticks, JUSTE le JSON`
        return parsed
      } catch {}
    }
    return {
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
  })
  const [showSettings, setShowSettings] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  // Save config to localStorage
  useEffect(() => {
    localStorage.setItem('nexusmind-ai-config', JSON.stringify(config))
  }, [config])

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  // Fetch models when settings opened
  const handleFetchModels = async () => {
    setLoadingModels(true)
    try {
      const m = await fetchModels(config)
      setModels(m)
    } catch {
      setModels([])
    }
    setLoadingModels(false)
  }

  // Get current mind map context for the AI
  const getCurrentMapContext = (): string => {
    const shape = editor.getShape(rootId as any)
    if (!shape) return 'Carte vide'
    const props = shape.props as unknown as MindNodeProps

    const serialize = (id: string, depth: number): string => {
      const s = editor.getShape(id as any)
      if (!s) return ''
      const p = s.props as unknown as MindNodeProps
      const indent = '  '.repeat(depth)
      let result = `${indent}- ${p.title}`
      for (const cid of p.childIds) {
        const child = editor.getShape(cid as any)
        if (child) result += '\n' + serialize(cid, depth + 1)
      }
      return result
    }

    return serialize(rootId, 0)
  }

  // Apply AI response to the canvas
  const applyAIResponse = (response: AIResponse) => {
    editor.run(() => {
      if (response.action === 'create') {
        // Delete all existing nodes
        const allShapes = editor.getCurrentPageShapes().filter(s => s.type === MIND_NODE_TYPE)
        editor.deleteShapes(allShapes.map(s => s.id))

        // Build new tree
        if (response.nodes.length > 0) {
          const newRootId = createNodeTree(editor, response.nodes[0], 'root', theme, 0, null)
          // Update rootId in parent component via custom event
          window.dispatchEvent(new CustomEvent('nexusmind-newroot', { detail: newRootId }))
          autoLayout(editor, newRootId)
          editor.select(newRootId as any)
        }
      } else if (response.action === 'add') {
        // Add nodes as children of selected node
        const targetId = selectedId || rootId
        const target = editor.getShape(targetId as any)
        if (!target) return
        const targetProps = target.props as unknown as MindNodeProps
        const newChildIds: string[] = []

        for (const node of response.nodes) {
          const childId = createNodeTree(editor, node, targetProps.level === 'root' ? 'main' : 'sub', theme, 0, targetId)
          newChildIds.push(childId)
        }

        // Update parent's childIds
        editor.updateShape({
          id: targetId as any,
          type: MIND_NODE_TYPE,
          props: { ...targetProps, childIds: [...targetProps.childIds, ...newChildIds] },
        } as any)

        autoLayout(editor, rootId)
        editor.select(targetId as any)
      } else if (response.action === 'restructure' || response.action === 'modify') {
        // Delete all and recreate
        const allShapes = editor.getCurrentPageShapes().filter(s => s.type === MIND_NODE_TYPE)
        editor.deleteShapes(allShapes.map(s => s.id))

        if (response.nodes.length > 0) {
          const newRootId = createNodeTree(editor, response.nodes[0], 'root', theme, 0, null)
          window.dispatchEvent(new CustomEvent('nexusmind-newroot', { detail: newRootId }))
          autoLayout(editor, newRootId)
          editor.select(newRootId as any)
        }
      } else if (response.action === 'delete' && response.deleteTitles) {
        // Find and delete nodes by title
        const allShapes = editor.getCurrentPageShapes().filter(s => s.type === MIND_NODE_TYPE)
        for (const title of response.deleteTitles) {
          const toDelete = allShapes.find(s => {
            const p = s.props as unknown as MindNodeProps
            return p.title.toLowerCase().includes(title.toLowerCase())
          })
          if (toDelete) {
            const props = toDelete.props as unknown as MindNodeProps
            // Collect descendants
            const ids = [toDelete.id as string]
            const collect = (id: string) => {
              const sh = editor.getShape(id as any)
              if (!sh) return
              const p = sh.props as unknown as MindNodeProps
              for (const cid of p.childIds) { ids.push(cid); collect(cid) }
            }
            collect(toDelete.id as string)
            // Remove from parent
            if (props.parentId) {
              const parent = editor.getShape(props.parentId as any)
              if (parent) {
                const pp = parent.props as unknown as MindNodeProps
                editor.updateShape({ id: props.parentId as any, type: MIND_NODE_TYPE, props: { ...pp, childIds: pp.childIds.filter(i => i !== toDelete.id) } } as any)
              }
            }
            editor.deleteShapes(ids as any[])
          }
        }
        autoLayout(editor, rootId)
      }
    })
  }

  // Create a tree of nodes from AI response
  const createNodeTree = (
    editor: Editor,
    node: AINode,
    level: 'root' | 'main' | 'sub',
    theme: MindMapTheme,
    branchIndex: number,
    parentId: string | null,
  ): string => {
    const props = getDefaultNodeProps(node.title, level, theme, branchIndex, parentId)
    const id = `shape:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

    const childIds: string[] = []
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        const childLevel = level === 'root' ? 'main' : 'sub'
        const childId = createNodeTree(editor, node.children[i], childLevel, theme, i, id)
        childIds.push(childId)
      }
    }

    props.childIds = childIds
    if (node.color) props.color = node.color

    editor.createShape({
      id: id as any,
      type: MIND_NODE_TYPE,
      x: 0, y: 0,
      rotation: 0, opacity: 1,
      props,
      meta: {},
    } as any)

    return id
  }

  // Send message
  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      // Build context for AI
      const mapContext = getCurrentMapContext()
      const contextMsg = `Contexte de la carte mentale actuelle:\n${mapContext}\n\nDemande: ${userMsg.content}${selectedId ? `\n(Nœud sélectionné: ${(editor.getShape(selectedId as any)?.props as unknown as MindNodeProps)?.title || 'aucun'})` : ''}`

      const apiMessages = [
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: contextMsg },
      ]

      const aiResponse = await callAI(config, apiMessages)

      const assistantMsg: ChatMessage = { role: 'assistant', content: aiResponse, timestamp: Date.now() }
      setMessages([...newMessages, assistantMsg])

      // Parse and apply
      console.log('[NexusMind AI] Raw response:', aiResponse)
      const parsed = parseAIResponse(aiResponse)
      console.log('[NexusMind AI] Parsed:', parsed)
      if (parsed) {
        applyAIResponse(parsed)
        const infoMsg: ChatMessage = {
          role: 'assistant',
          content: `✅ Carte mentale mise à jour${parsed.instructions ? `: ${parsed.instructions}` : ''}`,
          timestamp: Date.now(),
        }
        setMessages(prev => [...prev, infoMsg])
      } else {
        const warnMsg: ChatMessage = {
          role: 'assistant',
          content: '⚠️ Réponse reçue mais format JSON non reconnu. La carte n\'a pas été modifiée.',
          timestamp: Date.now(),
        }
        setMessages(prev => [...prev, warnMsg])
      }
    } catch (err) {
      const errStr = err instanceof Error ? err.message : String(err)
      setError(errStr)
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `❌ Erreur: ${errStr}\n\nVérifiez votre configuration IA (URL du serveur, modèle).`,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errMsg])
    }

    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Quick prompts
  const quickPrompts = [
    'Crée une carte mentale sur l\'intelligence artificielle',
    'Ajoute 3 sous-nœuds au nœud sélectionné',
    'Crée une carte pour planifier un projet web',
    'Restructure la carte en 4 branches principales',
  ]

  return (
    <div className="ai-chat-panel">
      {/* Header */}
      <div className="ai-chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bot size={18} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Assistant IA</span>
          <span style={{ fontSize: 11, color: '#8e8ea0', marginLeft: 4 }}>{config.model}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <div className="toolbar-btn" title="Paramètres IA" onClick={() => { setShowSettings(!showSettings); if (!showSettings) handleFetchModels() }}>
            <Settings size={16} />
          </div>
          <div className="toolbar-btn" onClick={onClose}><X size={16} /></div>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="ai-settings">
          <label className="prop-label">Serveur (URL de base)</label>
          <input
            className="prop-input"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="http://localhost:11434/v1"
          />
          <div style={{ fontSize: 11, color: '#6a6a8a', marginBottom: 8 }}>
            Ollama: http://localhost:11434/v1 · OpenAI: https://api.openai.com/v1 · LM Studio: http://localhost:1234/v1
          </div>

          <label className="prop-label">Clé API (optionnel pour Ollama)</label>
          <input
            className="prop-input"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="ollama"
          />

          <label className="prop-label">Modèle</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              className="prop-input"
              style={{ flex: 1 }}
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder="llama3.2"
            />
            {models.length > 0 && (
              <select
                className="toolbar-select"
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                value=""
                style={{ width: 'auto' }}
              >
                <option value="">Choisir...</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>
          {loadingModels && <div style={{ fontSize: 11, color: '#8e8ea0' }}>Chargement des modèles...</div>}
          {models.length > 0 && (
            <div style={{ fontSize: 11, color: '#52b788', marginTop: 2 }}>{models.length} modèle(s) disponible(s)</div>
          )}

          <label className="prop-label">Température: {config.temperature}</label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={config.temperature}
            onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />

          <label className="prop-label">Max tokens: {config.maxTokens}</label>
          <input
            type="range"
            min={256}
            max={8192}
            step={256}
            value={config.maxTokens}
            onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
            style={{ width: '100%' }}
          />

          <label className="prop-label">System prompt</label>
          <textarea
            className="prop-textarea"
            style={{ minHeight: 100, fontSize: 11, fontFamily: 'monospace' }}
            value={config.systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
          />

          <button
            className="ai-test-btn"
            onClick={async () => {
              setLoadingModels(true)
              try {
                const r = await fetch(`${config.baseUrl}/models`)
                if (r.ok) {
                  const d = await r.json()
                  const m = d.data?.map((x: any) => x.id) || []
                  setModels(m)
                  setError(null)
                } else {
                  setError(`Serveur inaccessible (${r.status})`)
                }
              } catch (e) {
                setError(`Connexion impossible: ${e instanceof Error ? e.message : String(e)}`)
              }
              setLoadingModels(false)
            }}
          >
            {loadingModels ? 'Test en cours...' : 'Tester la connexion'}
          </button>
          {error && <div className="ai-error">{error}</div>}
        </div>
      )}

      {/* Chat messages */}
      <div className="ai-chat-messages" ref={chatRef}>
        {messages.length === 0 && (
          <div className="ai-welcome">
            <Bot size={32} style={{ opacity: 0.5, marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: '#8e8ea0', textAlign: 'center' }}>
              Décris la carte mentale que tu veux créer ou modifier.
              L'IA généréra la structure automatiquement.
            </p>
            <div className="ai-quick-prompts">
              {quickPrompts.map((p, i) => (
                <div key={i} className="ai-quick-prompt" onClick={() => setInput(p)}>
                  {p}
                </div>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`ai-msg ai-msg-${msg.role}`}>
            <div className="ai-msg-icon">
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className="ai-msg-content">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="ai-msg ai-msg-assistant">
            <div className="ai-msg-icon"><Loader size={14} className="ai-spin" /></div>
            <div className="ai-msg-content">Réflexion en cours...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="ai-chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Décris ta carte mentale..."
          rows={2}
          disabled={loading}
        />
        <div className="ai-send-btn" onClick={handleSend} style={{ opacity: loading || !input.trim() ? 0.3 : 1 }}>
          <Send size={18} />
        </div>
      </div>
    </div>
  )
}