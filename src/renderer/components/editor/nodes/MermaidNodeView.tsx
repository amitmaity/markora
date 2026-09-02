import React, { useState, useEffect, useRef, useCallback } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import mermaid from 'mermaid'
import { Code, Eye } from 'lucide-react'

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'inherit'
})

let mermaidIdCounter = 0

interface Props {
  node: { attrs: { code: string } }
  updateAttributes: (attrs: Record<string, unknown>) => void
}

export default function MermaidNodeView({ node, updateAttributes }: Props) {
  const [editing, setEditing] = useState(node.attrs.code === '')
  const [draft, setDraft] = useState(node.attrs.code)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(`mermaid-${++mermaidIdCounter}`)

  const renderDiagram = useCallback(async (code: string) => {
    if (!code.trim()) { setSvg(''); return }
    try {
      const { svg: rendered } = await mermaid.render(idRef.current, code)
      setSvg(rendered)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? 'Diagram error')
      setSvg('')
    }
  }, [])

  useEffect(() => {
    renderDiagram(node.attrs.code)
  }, [node.attrs.code])

  const handleSave = () => {
    updateAttributes({ code: draft })
    renderDiagram(draft)
    setEditing(false)
  }

  return (
    <NodeViewWrapper className="mermaid-node-wrapper" style={{ margin: '1em 0' }}>
      <div
        style={{
          borderRadius: 8,
          border: '1px solid var(--chrome-border, #d0d7de)',
          overflow: 'hidden',
          background: 'var(--code-bg, #f6f8fa)'
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            borderBottom: '1px solid var(--chrome-border, #d0d7de)',
            background: 'var(--chrome-bg, #f6f8fa)'
          }}
        >
          <span style={{ fontSize: 11, opacity: 0.5, color: 'var(--text-color)' }}>Mermaid Diagram</span>
          <button
            onClick={() => setEditing((v) => !v)}
            style={{
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid var(--chrome-border)',
              background: 'var(--editor-bg)',
              cursor: 'pointer',
              color: 'var(--text-color)'
            }}
          >
            {editing ? <Eye size={11} /> : <Code size={11} />}
            {editing ? 'Preview' : 'Edit'}
          </button>
        </div>

        {/* Edit mode */}
        {editing ? (
          <div style={{ padding: 8 }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              style={{
                width: '100%',
                fontFamily: 'var(--mono-font, monospace)',
                fontSize: '0.875em',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                resize: 'vertical',
                color: 'var(--text-color)'
              }}
              placeholder="graph TD&#10;    A[Start] --> B[End]"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={handleSave}
                style={{
                  fontSize: 12,
                  padding: '3px 10px',
                  borderRadius: 4,
                  border: 'none',
                  background: 'var(--link-color, #0366d6)',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Apply
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 16, display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
            {error ? (
              <div style={{ color: 'red', fontSize: '0.85em', padding: 8 }}>
                <strong>Diagram error:</strong> {error}
              </div>
            ) : svg ? (
              <div dangerouslySetInnerHTML={{ __html: svg }} style={{ maxWidth: '100%' }} />
            ) : (
              <div style={{ opacity: 0.4, fontSize: '0.85em', color: 'var(--text-color)' }}>
                Empty diagram — click Edit to add content
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
