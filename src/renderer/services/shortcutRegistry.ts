import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'
import { saveFile, saveFileAs, openFile } from './fileService'
import type { Editor } from '@tiptap/core'

type ShortcutHandler = (e: KeyboardEvent) => void

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
const mod = (e: KeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey)

function matchShortcut(
  e: KeyboardEvent,
  opts: { key: string; mod?: boolean; shift?: boolean; alt?: boolean }
): boolean {
  const needsMod = opts.mod ?? false
  const needsShift = opts.shift ?? false
  const needsAlt = opts.alt ?? false
  return (
    e.key.toLowerCase() === opts.key.toLowerCase() &&
    mod(e) === needsMod &&
    e.shiftKey === needsShift &&
    e.altKey === needsAlt
  )
}

export function useShortcuts(editorRef: React.MutableRefObject<Editor | null>): void {
  useEffect(() => {
    const handler: ShortcutHandler = async (e) => {
      const editor = editorRef.current
      // Read the store fresh per keystroke instead of subscribing (the
      // state object identity changes on every update)
      const store = useEditorStore.getState()

      // --- File ---
      if (matchShortcut(e, { key: 's', mod: true })) {
        e.preventDefault()
        await saveFile()
        return
      }
      if (matchShortcut(e, { key: 's', mod: true, shift: true })) {
        e.preventDefault()
        await saveFileAs()
        return
      }
      if (matchShortcut(e, { key: 'o', mod: true })) {
        e.preventDefault()
        await openFile()
        return
      }
      if (matchShortcut(e, { key: 'n', mod: true })) {
        e.preventDefault()
        store.setDocument(null, '')
        return
      }

      // --- View Modes ---
      if (matchShortcut(e, { key: '/', mod: true })) {
        e.preventDefault()
        store.toggleSourceMode()
        return
      }
      if (e.key === 'F8') {
        e.preventDefault()
        store.toggleFocusMode()
        return
      }
      if (e.key === 'F9') {
        e.preventDefault()
        store.toggleTypewriterMode()
        return
      }
      if (matchShortcut(e, { key: '`', mod: true })) {
        e.preventDefault()
        store.toggleSidebar()
        return
      }

      // --- Find / Replace ---
      if (matchShortcut(e, { key: 'f', mod: true })) {
        e.preventDefault()
        store.openFind(false)
        return
      }
      if (matchShortcut(e, { key: 'h', mod: true })) {
        e.preventDefault()
        store.openFind(true)
        return
      }

      // --- Formatting (delegate to editor) ---
      if (!editor) return

      if (matchShortcut(e, { key: 'b', mod: true })) {
        e.preventDefault()
        editor.chain().focus().toggleBold().run()
        return
      }
      if (matchShortcut(e, { key: 'i', mod: true })) {
        e.preventDefault()
        editor.chain().focus().toggleItalic().run()
        return
      }
      if (matchShortcut(e, { key: 'u', mod: true })) {
        e.preventDefault()
        editor.chain().focus().toggleUnderline().run()
        return
      }
      if (matchShortcut(e, { key: 'x', mod: true, shift: true })) {
        e.preventDefault()
        editor.chain().focus().toggleStrike().run()
        return
      }
      if (matchShortcut(e, { key: 'e', mod: true })) {
        e.preventDefault()
        editor.chain().focus().toggleCode().run()
        return
      }
      if (matchShortcut(e, { key: 'h', mod: true, shift: true })) {
        e.preventDefault()
        editor.chain().focus().toggleHighlight().run()
        return
      }

      // --- Headings ---
      for (let i = 1; i <= 6; i++) {
        if (matchShortcut(e, { key: `${i}`, mod: true })) {
          e.preventDefault()
          editor.chain().focus().toggleHeading({ level: i as 1|2|3|4|5|6 }).run()
          return
        }
      }
      if (matchShortcut(e, { key: '0', mod: true })) {
        e.preventDefault()
        editor.chain().focus().setParagraph().run()
        return
      }

      // --- Insert ---
      if (matchShortcut(e, { key: 'c', mod: true, alt: true }) || matchShortcut(e, { key: 'k', mod: true, shift: true })) {
        e.preventDefault()
        store.openSnippetModal()
        return
      }
      if (matchShortcut(e, { key: 't', mod: true, shift: true })) {
        e.preventDefault()
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editorRef])
}
