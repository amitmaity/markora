import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { editorInstance } from '../../services/editorInstance'
import type { HeadingItem } from '../../types/editor'

function headingPadding(level: number): number {
  return (level - 1) * 12
}

export default function OutlineView() {
  const { headings } = useEditorStore()

  const scrollToHeading = (heading: HeadingItem) => {
    const editor = editorInstance.current
    if (!editor) return
    try {
      // Scroll the heading's DOM node into view and place the cursor in it
      const dom = editor.view.nodeDOM(heading.pos) as HTMLElement | null
      if (dom) {
        dom.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      editor.commands.setTextSelection(heading.pos + 1)
    } catch {
      // ignore stale positions
    }
  }

  if (headings.length === 0) {
    return (
      <div className="px-3 py-4 text-xs opacity-40 text-center" style={{ color: 'var(--sidebar-text)' }}>
        No headings found
      </div>
    )
  }

  return (
    <div className="py-1">
      {headings.map((h, idx) => (
        <button
          key={idx}
          onClick={() => scrollToHeading(h)}
          className="w-full text-left text-xs py-1 hover:bg-black/5 transition-colors leading-tight"
          style={{
            paddingLeft: `${12 + headingPadding(h.level)}px`,
            paddingRight: '8px',
            color: 'var(--sidebar-text)',
            opacity: h.level === 1 ? 1 : h.level === 2 ? 0.85 : 0.7,
            fontWeight: h.level <= 2 ? 600 : 400
          }}
          title={h.text}
        >
          <span className="truncate block">{h.text}</span>
        </button>
      ))}
    </div>
  )
}
