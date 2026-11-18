import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'
import { saveFile, saveFileAs, openFile, closeTabWithConfirm } from './fileService'
import { insertTable } from './insertions'
import { richEditor } from './editorInstance'

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
const mod = (e: KeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey)

/** Physical key code for a letter or digit ('f' → 'KeyF', '1' → 'Digit1'). */
function codeFor(key: string): string {
  return /^[0-9]$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`
}

function matchShortcut(
  e: KeyboardEvent,
  opts: { key: string; mod?: boolean; shift?: boolean; alt?: boolean }
): boolean {
  const needsMod = opts.mod ?? false
  const needsShift = opts.shift ?? false
  const needsAlt = opts.alt ?? false
  // On macOS, Option changes e.key (Option+F is 'ƒ'), so Alt combos match on
  // the physical key. Everything else matches the typed character so other
  // keyboard layouts get the shortcut printed on their keys.
  const keyMatches = needsAlt
    ? e.code === codeFor(opts.key)
    : e.key.toLowerCase() === opts.key.toLowerCase()
  return keyMatches && mod(e) === needsMod && e.shiftKey === needsShift && e.altKey === needsAlt
}

function matchModShiftCode(e: KeyboardEvent, code: string): boolean {
  return e.code === code && mod(e) && e.shiftKey && !e.altKey
}

/** Focus is in a plain text field or the CodeMirror source editor. */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('.cm-editor')) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

/**
 * App-level shortcuts (tabs, files, view modes, find, insert dialogs).
 *
 * These run in the capture phase and stop propagation, so the editors' own
 * keymaps never also see the key: TipTap binds Mod-Shift-s (strike) and
 * Mod-Alt-c (code block), CodeMirror binds Mod-/ (comment) and Mod-f.
 * Returns true when the event was handled.
 */
function handleAppShortcut(e: KeyboardEvent): boolean {
  const store = useEditorStore.getState()

  // --- Tabs ---
  if (matchShortcut(e, { key: 't', mod: true })) {
    store.newTab()
    return true
  }
  if (matchShortcut(e, { key: 'w', mod: true })) {
    closeTabWithConfirm()
    return true
  }
  if (e.key === 'Tab' && e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.shiftKey) store.prevTab()
    else store.nextTab()
    return true
  }
  if (matchModShiftCode(e, 'BracketRight')) {
    store.nextTab()
    return true
  }
  if (matchModShiftCode(e, 'BracketLeft')) {
    store.prevTab()
    return true
  }

  // --- File ---
  if (matchShortcut(e, { key: 's', mod: true })) {
    void saveFile()
    return true
  }
  if (matchShortcut(e, { key: 's', mod: true, shift: true })) {
    void saveFileAs()
    return true
  }
  if (matchShortcut(e, { key: 'o', mod: true })) {
    void openFile()
    return true
  }
  if (matchShortcut(e, { key: 'n', mod: true })) {
    store.newTab()
    return true
  }

  // --- View Modes ---
  if (matchShortcut(e, { key: '/', mod: true })) {
    store.toggleSourceMode()
    return true
  }
  if (e.key === 'F8' && !mod(e) && !e.shiftKey && !e.altKey) {
    store.toggleFocusMode()
    return true
  }
  if (e.key === 'F9' && !mod(e) && !e.shiftKey && !e.altKey) {
    store.toggleTypewriterMode()
    return true
  }
  if (matchShortcut(e, { key: '`', mod: true })) {
    store.toggleSidebar()
    return true
  }

  // --- Find / Replace --- (Cmd+H is Hide on macOS, so replace is Cmd+Alt+F there)
  if (matchShortcut(e, { key: 'f', mod: true })) {
    store.openFind(false)
    return true
  }
  if (
    isMac
      ? matchShortcut(e, { key: 'f', mod: true, alt: true })
      : matchShortcut(e, { key: 'h', mod: true })
  ) {
    store.openFind(true)
    return true
  }

  // --- Insert ---
  if (matchShortcut(e, { key: 'c', mod: true, alt: true })) {
    store.openSnippetModal()
    return true
  }
  if (matchShortcut(e, { key: 't', mod: true, shift: true })) {
    insertTable()
    return true
  }

  return false
}

/**
 * Rich-text formatting shortcuts. These run in the bubble phase and skip
 * events an editor already handled (TipTap binds Mod-b, Mod-i, Mod-u, Mod-e,
 * Mod-Shift-h and the list keys itself), so a key never toggles twice.
 * They mainly cover focus outside the editor and keys TipTap doesn't bind.
 * Returns true when the event was handled.
 */
function handleFormatShortcut(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || isTextField(e.target)) return false
  const editor = richEditor()
  if (!editor) return false

  const run = (fn: () => void): true => {
    fn()
    return true
  }

  if (matchShortcut(e, { key: 'b', mod: true })) return run(() => editor.chain().focus().toggleBold().run())
  if (matchShortcut(e, { key: 'i', mod: true })) return run(() => editor.chain().focus().toggleItalic().run())
  if (matchShortcut(e, { key: 'u', mod: true })) return run(() => editor.chain().focus().toggleUnderline().run())
  if (matchShortcut(e, { key: 'x', mod: true, shift: true }))
    return run(() => editor.chain().focus().toggleStrike().run())
  if (matchShortcut(e, { key: 'e', mod: true })) return run(() => editor.chain().focus().toggleCode().run())
  if (matchShortcut(e, { key: 'h', mod: true, shift: true }))
    return run(() => editor.chain().focus().toggleHighlight().run())

  if (matchModShiftCode(e, 'Digit8')) return run(() => editor.chain().focus().toggleBulletList().run())
  if (matchModShiftCode(e, 'Digit7')) return run(() => editor.chain().focus().toggleOrderedList().run())
  if (matchModShiftCode(e, 'Digit9')) return run(() => editor.chain().focus().toggleTaskList().run())
  if (matchShortcut(e, { key: 'q', mod: true, shift: true }))
    return run(() => editor.chain().focus().toggleBlockquote().run())
  if (e.code === 'Minus' && mod(e) && e.altKey && !e.shiftKey)
    return run(() => editor.chain().focus().setHorizontalRule().run())

  // --- Headings ---
  for (let i = 1; i <= 6; i++) {
    if (matchShortcut(e, { key: `${i}`, mod: true })) {
      return run(() =>
        editor.chain().focus().toggleHeading({ level: i as 1 | 2 | 3 | 4 | 5 | 6 }).run()
      )
    }
  }
  if (matchShortcut(e, { key: '0', mod: true })) return run(() => editor.chain().focus().setParagraph().run())

  return false
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDownCapture = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if (handleAppShortcut(e)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if (handleFormatShortcut(e)) e.preventDefault()
    }

    window.addEventListener('keydown', onKeyDownCapture, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDownCapture, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}
