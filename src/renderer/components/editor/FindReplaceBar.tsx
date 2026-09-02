import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, ChevronUp, ChevronDown, Replace, CaseSensitive, Regex } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import type { Editor } from '@tiptap/core'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { FindPluginKey } from './extensions/FindHighlight'

interface Props {
  editor: Editor | null
}

interface Match {
  from: number
  to: number
  text: string
}

const MAX_MATCHES = 2000

/**
 * Builds a flat text representation of the doc alongside a per-character
 * map to ProseMirror positions. Block boundaries become '\n' entries with a
 * position of -1, so matches can be prevented from spanning blocks.
 */
function buildIndex(doc: any): { text: string; positions: number[] } {
  let text = ''
  const positions: number[] = []
  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) positions.push(pos + i)
      text += node.text
    } else if (node.isBlock && text.length > 0 && text[text.length - 1] !== '\n') {
      positions.push(-1)
      text += '\n'
    }
  })
  return { text, positions }
}

function findMatches(editor: Editor, query: string, caseSensitive: boolean, useRegex: boolean): Match[] {
  if (!query) return []
  const { text, positions } = buildIndex(editor.state.doc)
  const matches: Match[] = []

  const push = (start: number, end: number, matchText: string) => {
    for (let i = start; i < end; i++) {
      if (positions[i] === -1) return // skip matches spanning block boundaries
    }
    matches.push({ from: positions[start], to: positions[end - 1] + 1, text: matchText })
  }

  if (useRegex) {
    let re: RegExp
    try {
      re = new RegExp(query, caseSensitive ? 'g' : 'gi')
    } catch {
      return [] // invalid regex
    }
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++
        continue
      }
      push(m.index, m.index + m[0].length, m[0])
      if (matches.length >= MAX_MATCHES) break
    }
  } else {
    const hay = caseSensitive ? text : text.toLowerCase()
    const needle = caseSensitive ? query : query.toLowerCase()
    if (!needle) return []
    let pos = 0
    while ((pos = hay.indexOf(needle, pos)) !== -1) {
      push(pos, pos + needle.length, text.slice(pos, pos + needle.length))
      pos += needle.length
      if (matches.length >= MAX_MATCHES) break
    }
  }
  return matches
}

export default function FindReplaceBar({ editor }: Props) {
  const { isFindOpen, isReplaceOpen, closeFind } = useEditorStore()
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [currentMatch, setCurrentMatch] = useState(0) // 1-based; 0 = none
  const queryRef = useRef<HTMLInputElement>(null)

  const activeIdx = matches.length > 0 ? Math.min(Math.max(currentMatch - 1, 0), matches.length - 1) : -1

  useEffect(() => {
    if (isFindOpen && queryRef.current) {
      queryRef.current.focus()
      queryRef.current.select()
    }
  }, [isFindOpen])

  const clearDecorations = useCallback(() => {
    if (!editor?.view) return
    try {
      editor.view.dispatch(editor.state.tr.setMeta(FindPluginKey, DecorationSet.empty))
    } catch {
      // view may be gone during unmount
    }
  }, [editor])

  const applyDecorations = useCallback(
    (list: Match[], active: number) => {
      if (!editor?.view) return
      try {
        const decos = list.map((m, i) =>
          Decoration.inline(m.from, m.to, {
            class: i === active ? 'find-match find-match-active' : 'find-match'
          })
        )
        const tr = editor.state.tr
          .setMeta(FindPluginKey, DecorationSet.create(editor.state.doc, decos))
          .setMeta('preventUpdate', true) // don't dirty the document / trigger onUpdate
        editor.view.dispatch(tr)
      } catch {
        // position may be stale if the doc changed between compute and dispatch
      }
    },
    [editor]
  )

  const recompute = useCallback(() => {
    if (!editor || !query) {
      setMatches([])
      return
    }
    const found = findMatches(editor, query, caseSensitive, useRegex)
    setMatches(found)
  }, [editor, query, caseSensitive, useRegex])

  // Recompute matches when the query/options change and whenever the doc
  // changes while the bar is open.
  useEffect(() => {
    if (!editor) return
    recompute()
    const onUpdate = () => recompute()
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor, recompute])

  // Clear decorations when the bar unmounts (find closed)
  useEffect(() => {
    return () => clearDecorations()
  }, [clearDecorations])

  // Highlight all matches, with the active one emphasized
  useEffect(() => {
    applyDecorations(matches, activeIdx)
  }, [matches, activeIdx, applyDecorations])

  // Keep the current match within [1..matches.length] (0 when none)
  useEffect(() => {
    if (matches.length === 0) {
      if (currentMatch !== 0) setCurrentMatch(0)
    } else if (currentMatch < 1 || currentMatch > matches.length) {
      setCurrentMatch(1)
    }
  }, [matches, currentMatch])

  const goTo = (idx: number) => {
    if (!editor || matches.length === 0) return
    const wrapped = ((idx % matches.length) + matches.length) % matches.length
    const m = matches[wrapped]
    editor.chain().focus().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run()
    setCurrentMatch(wrapped + 1)
    queryRef.current?.focus()
    queryRef.current?.select()
  }

  const replacementFor = (m: Match): string => {
    if (!useRegex) return replacement
    try {
      return m.text.replace(new RegExp(query, caseSensitive ? '' : 'i'), replacement)
    } catch {
      return replacement
    }
  }

  const handleReplace = () => {
    if (!editor || matches.length === 0 || !query) return
    const m = matches[activeIdx]
    const repl = replacementFor(m)
    try {
      editor.view.dispatch(editor.state.tr.replaceWith(m.from, m.to, editor.state.schema.text(repl)))
      editor.commands.setTextSelection({ from: m.from, to: m.from + repl.length })
      editor.commands.scrollIntoView()
    } catch {
      return
    }
    // matches recompute via the update listener; stay on the same index so
    // the next occurrence is selected
    setCurrentMatch(activeIdx + 1)
    queryRef.current?.focus()
  }

  const handleReplaceAll = () => {
    if (!editor || matches.length === 0 || !query) return
    // Apply from last to first so earlier positions stay valid
    const tr = editor.state.tr
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i]
      tr.replaceWith(m.from, m.to, editor.state.schema.text(replacementFor(m)))
    }
    try {
      editor.view.dispatch(tr)
      editor.commands.scrollIntoView()
    } catch {
      return
    }
    setCurrentMatch(1)
    queryRef.current?.focus()
  }

  if (!isFindOpen) return null

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid var(--chrome-border)',
    background: 'var(--editor-bg)',
    color: 'var(--text-color)',
    fontSize: 13,
    outline: 'none'
  }

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 6px',
    borderRadius: 4,
    border: '1px solid var(--chrome-border)',
    background: active ? 'var(--link-color)' : 'var(--editor-bg)',
    color: active ? 'white' : 'var(--text-color)',
    cursor: 'pointer',
    fontSize: 11
  })

  const iconBtnStyle: React.CSSProperties = {
    padding: '3px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--text-color)'
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 12,
        zIndex: 100,
        background: 'var(--chrome-bg)',
        border: '1px solid var(--chrome-border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        padding: '8px 10px',
        minWidth: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
    >
      {/* Find row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          ref={queryRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeFind()
            if (e.key === 'Enter') {
              e.preventDefault()
              if (e.shiftKey) goTo(activeIdx - 1)
              else goTo(activeIdx + 1)
            }
          }}
          placeholder="Find…"
          style={inputStyle}
        />

        {/* Toggle buttons */}
        <button onClick={() => setCaseSensitive((v) => !v)} title="Case sensitive" style={toggleStyle(caseSensitive)}>
          <CaseSensitive size={13} />
        </button>
        <button onClick={() => setUseRegex((v) => !v)} title="Use regex" style={toggleStyle(useRegex)}>
          <Regex size={13} />
        </button>

        {/* Match counter */}
        <span
          style={{ fontSize: 11, opacity: 0.6, color: 'var(--text-color)', whiteSpace: 'nowrap', minWidth: 48 }}
        >
          {query ? `${currentMatch}/${matches.length}` : ''}
        </span>

        {/* Prev/Next */}
        <button
          onClick={() => goTo(activeIdx - 1)}
          style={iconBtnStyle}
          title="Previous (Shift+Enter)"
          disabled={matches.length === 0}
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={() => goTo(activeIdx + 1)}
          style={iconBtnStyle}
          title="Next (Enter)"
          disabled={matches.length === 0}
        >
          <ChevronDown size={14} />
        </button>

        {/* Close */}
        <button onClick={closeFind} style={{ ...iconBtnStyle, opacity: 0.5 }} title="Close (Esc)">
          <X size={14} />
        </button>
      </div>

      {/* Replace row */}
      {isReplaceOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="text"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeFind()
            }}
            placeholder="Replace with…"
            style={inputStyle}
          />
          <button
            onClick={handleReplace}
            disabled={matches.length === 0}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid var(--chrome-border)',
              background: 'var(--editor-bg)',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text-color)',
              display: 'flex',
              alignItems: 'center',
              gap: 3
            }}
          >
            <Replace size={12} /> Replace
          </button>
          <button
            onClick={handleReplaceAll}
            disabled={matches.length === 0}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid var(--chrome-border)',
              background: 'var(--editor-bg)',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text-color)'
            }}
          >
            All
          </button>
        </div>
      )}
    </div>
  )
}
