import { useState, useRef, useEffect } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import katex from 'katex'

export default function MathNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const latex = (node.attrs.latex as string | undefined) ?? ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(latex)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Set when Escape cancels, so the blur that follows doesn't save
  const cancelledRef = useRef(false)
  const isBlock = node.type.name === 'mathBlock'
  // `$$…$$` inside a paragraph: inline node rendered in display style
  const displayMode = isBlock || !!node.attrs.display

  useEffect(() => {
    setDraft(latex)
  }, [latex])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const renderedHtml = (() => {
    try {
      const html = katex.renderToString(latex || '\\placeholder{}', {
        displayMode,
        throwOnError: true,
        output: 'html'
      })
      return { html, err: null }
    } catch (e: any) {
      return { html: '', err: e.message as string }
    }
  })()

  const startEditing = () => {
    cancelledRef.current = false
    setError(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    cancelledRef.current = true
    setError(null)
    setDraft(latex)
    setEditing(false)
  }

  const handleSave = () => {
    if (cancelledRef.current) return
    try {
      katex.renderToString(draft, { throwOnError: true })
    } catch (e) {
      // Stay in edit mode so the error is visible and the edit isn't lost
      setError(e instanceof Error ? e.message : String(e))
      return
    }
    updateAttributes({ latex: draft })
    setError(null)
    setEditing(false)
  }

  const Tag = isBlock ? 'div' : 'span'

  return (
    <NodeViewWrapper as={Tag} className={`math-node ${isBlock ? 'math-block' : 'math-inline'}`}>
      {!editing ? (
        <Tag
          onClick={startEditing}
          style={{
            cursor: 'pointer',
            display: isBlock ? 'block' : 'inline',
            padding: isBlock ? '0.5em 0' : undefined,
            outline: selected ? '2px solid var(--link-color, #0366d6)' : 'none',
            borderRadius: 3
          }}
        >
          {renderedHtml.err ? (
            <span style={{ color: 'red', fontSize: '0.85em' }}>{renderedHtml.err}</span>
          ) : (
            <span
              dangerouslySetInnerHTML={{ __html: renderedHtml.html }}
              style={{ display: isBlock ? 'block' : 'inline' }}
            />
          )}
        </Tag>
      ) : (
        <Tag
          style={{
            display: isBlock ? 'block' : 'inline-block',
            border: '1px solid var(--link-color, #0366d6)',
            borderRadius: 4,
            padding: '4px 8px',
            background: 'var(--code-bg, #f6f8fa)'
          }}
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
              if (e.key === 'Escape') cancelEditing()
            }}
            onBlur={handleSave}
            rows={isBlock ? 3 : 1}
            style={{
              display: 'block',
              width: isBlock ? '100%' : 'auto',
              minWidth: 120,
              resize: isBlock ? 'vertical' : 'none',
              fontFamily: 'var(--mono-font, monospace)',
              fontSize: '0.875em',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text-color)'
            }}
            placeholder="LaTeX formula…"
          />
          {/* Live preview below textarea */}
          <div style={{ marginTop: 4, opacity: 0.7, fontSize: '0.9em' }}>
            {draft && (() => {
              try {
                return (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: katex.renderToString(draft, { displayMode, throwOnError: false })
                    }}
                  />
                )
              } catch {
                return null
              }
            })()}
          </div>
          {error && <div style={{ color: 'red', fontSize: '0.75em', marginTop: 2 }}>{error}</div>}
        </Tag>
      )}
    </NodeViewWrapper>
  )
}
