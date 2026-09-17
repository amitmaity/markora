import React, { useEffect, useState, useRef } from 'react'
import type { Editor } from '@tiptap/core'
import {
  Bold, Italic, Strikethrough, Code, CodeXml, Link as LinkIcon, Underline as UnderlineIcon, Highlighter,
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Quote, Minus, RemoveFormatting
} from 'lucide-react'

interface Props {
  editor: Editor | null
}

export default function FloatingToolbar({ editor }: Props) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editor) return

    const updateMenu = () => {
      const { state, view } = editor
      if (!view || !state) return
      const { from, to, empty } = state.selection

      if (empty) {
        setCoords(null)
        return
      }

      try {
        const start = view.coordsAtPos(from)
        const end = view.coordsAtPos(to)
        const menuWidth = menuRef.current?.offsetWidth || 560
        const top = Math.max(10, start.top - 46)
        const left = Math.min(
          Math.max(10, (start.left + end.left) / 2 - menuWidth / 2),
          window.innerWidth - menuWidth - 10
        )
        setCoords({ top, left })
      } catch {
        setCoords(null)
      }
    }

    const onBlur = () => setCoords(null)

    editor.on('selectionUpdate', updateMenu)
    editor.on('transaction', updateMenu)
    editor.on('blur', onBlur)

    const scroller = editor.view.dom.closest('.editor-content')
    scroller?.addEventListener('scroll', updateMenu)

    return () => {
      editor.off('selectionUpdate', updateMenu)
      editor.off('transaction', updateMenu)
      editor.off('blur', onBlur)
      scroller?.removeEventListener('scroll', updateMenu)
    }
  }, [editor])

  if (!editor || !coords) return null

  const btn = (
    icon: React.ReactNode,
    action: () => void,
    isActive: boolean,
    title: string
  ) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        action()
      }}
      title={title}
      style={{
        padding: '4px 6px',
        background: isActive ? 'rgba(255,255,255,0.25)' : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.1s'
      }}
    >
      {icon}
    </button>
  )

  const divider = (
    <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
  )

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '3px 6px',
        background: '#1e1e2e',
        color: 'white',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.15)',
        pointerEvents: 'auto'
      }}
    >
      {btn(<Bold size={13} />, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), 'Bold (⌘B)')}
      {btn(<Italic size={13} />, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), 'Italic (⌘I)')}
      {btn(<UnderlineIcon size={13} />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), 'Underline (⌘U)')}
      {btn(<Strikethrough size={13} />, () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'), 'Strikethrough (⌘⇧X)')}
      {btn(<Code size={13} />, () => editor.chain().focus().toggleCode().run(), editor.isActive('code'), 'Inline Code (⌘E)')}
      {btn(<CodeXml size={13} />, () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'), 'Code Block (⌘⌥C)')}
      {btn(<Highlighter size={13} />, () => editor.chain().focus().toggleHighlight().run(), editor.isActive('highlight'), 'Highlight (⌘⇧H)')}

      {divider}

      {btn(<Heading1 size={13} />, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), 'Heading 1')}
      {btn(<Heading2 size={13} />, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), 'Heading 2')}
      {btn(<Heading3 size={13} />, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), 'Heading 3')}

      {divider}

      {btn(<List size={13} />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), 'Bullet List (⌘⇧8)')}
      {btn(<ListOrdered size={13} />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), 'Ordered List (⌘⇧7)')}
      {btn(<ListChecks size={13} />, () => editor.chain().focus().toggleTaskList().run(), editor.isActive('taskList'), 'Task List (⌘⇧9)')}
      {btn(<Quote size={13} />, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), 'Block Quote (⌘⇧Q)')}
      {btn(<Minus size={13} />, () => editor.chain().focus().setHorizontalRule().run(), false, 'Horizontal Rule')}
      {btn(
        <RemoveFormatting size={13} />,
        () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
        false,
        'Clear Formatting'
      )}

      {divider}

      {btn(
        <LinkIcon size={13} />,
        () => {
          const url = window.prompt('Enter URL:')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        },
        editor.isActive('link'),
        'Link'
      )}
    </div>
  )
}
