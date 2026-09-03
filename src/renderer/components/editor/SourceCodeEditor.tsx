import React, { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorState } from '@codemirror/state'
import { openSearchPanel, closeSearchPanel, searchPanelOpen } from '@codemirror/search'
import { useEditorStore } from '../../store/editorStore'
import { sourceEditorInstance } from '../../services/editorInstance'

interface Props {
  initialContent: string
  onChange: (content: string) => void
}

export default function SourceCodeEditor({ initialContent, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { activeTheme } = useEditorStore()

  const isDark = activeTheme === 'night'

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: initialContent,
        extensions: [
          basicSetup,
          markdown(),
          ...(isDark ? [oneDark] : []),
          EditorView.theme({
            '&': {
              height: '100%',
              fontFamily: 'var(--mono-font, "JetBrains Mono", Consolas, monospace)',
              fontSize: '14px',
              background: 'var(--editor-bg)',
            },
            '.cm-scroller': {
              padding: '48px 60px',
              lineHeight: '1.6',
            },
            '.cm-content': {
              maxWidth: 'var(--content-max-width, 860px)',
              margin: '0 auto',
              color: 'var(--text-color)',
            },
            '.cm-gutters': {
              background: 'var(--chrome-bg)',
              color: 'var(--chrome-text)',
              border: 'none',
              borderRight: '1px solid var(--chrome-border)',
            },
            '.cm-activeLineGutter, .cm-activeLine': {
              background: 'rgba(0,0,0,0.04)',
            },
            '.cm-focused': {
              outline: 'none',
            }
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString())
            }
            // Keep the store in sync when the panel is closed via its own
            // button or the Escape key
            if (searchPanelOpen(update.startState) && !searchPanelOpen(update.state)) {
              useEditorStore.getState().closeFind()
            }
          })
        ]
      }),
      parent: containerRef.current
    })

    viewRef.current = view
    sourceEditorInstance.current = view

    // Reopen the find panel if find was active when this editor mounted
    if (useEditorStore.getState().isFindOpen) {
      try {
        openSearchPanel(view)
      } catch {
        // ignore
      }
    }

    return () => {
      try {
        if (searchPanelOpen(view.state)) closeSearchPanel(view)
      } catch {
        // ignore
      }
      view.destroy()
      viewRef.current = null
      if (sourceEditorInstance.current === view) sourceEditorInstance.current = null
    }
  }, [isDark]) // re-create when theme changes between dark/light

  // Sync content if it changed externally (e.g., file opened)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentContent = view.state.doc.toString()
    if (currentContent !== initialContent) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: initialContent }
      })
    }
  }, [initialContent])

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflow: 'auto',
        background: 'var(--editor-bg)'
      }}
    />
  )
}
