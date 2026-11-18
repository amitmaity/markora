import { useEffect } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorStore, getActiveTab } from '../store/editorStore'
import { editorInstance, richEditor } from './editorInstance'
import { useShortcuts } from './shortcutRegistry'
import { saveFile, saveFileAs, closeTabWithConfirm } from './fileService'
import {
  insertTable,
  insertMermaidDiagram,
  insertImageFromPicker,
  insertLinkFromPrompt
} from './insertions'
import { exportDocumentToPdf, exportDocumentToHtml } from './exportService'

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/**
 * Exports read the rendered TipTap DOM. In Source Code Mode that DOM is
 * hidden and stale, so switch back to rich mode first and give the editor
 * (and async node views like Mermaid) a moment to re-render.
 */
async function editorForExport(): Promise<Editor | null> {
  const store = useEditorStore.getState()
  if (store.isSourceMode) {
    store.toggleSourceMode()
    await nextFrame()
    await nextFrame()
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return editorInstance.current
}

/**
 * Registers global menu-action handlers and keyboard shortcuts once at the
 * app layout level so per-tab editors don't each bind the same listeners.
 */
export function useAppActions(): void {
  useEffect(() => {
    if (!window.electronAPI) return

    const off = window.electronAPI.onMenuAction(async (action: string) => {
      // Null in Source Code Mode — rich-text commands are no-ops there
      // rather than running on the hidden, stale TipTap document.
      const ed = richEditor()
      const store = useEditorStore.getState()
      const tab = getActiveTab()

      switch (action) {
        case 'file:new':
        case 'tab:new':
          store.newTab()
          break
        case 'tab:close':
          closeTabWithConfirm()
          break
        case 'tab:next':
          store.nextTab()
          break
        case 'tab:prev':
          store.prevTab()
          break
        case 'file:save':
          saveFile()
          break
        case 'file:saveAs':
          saveFileAs()
          break
        case 'mode:source:toggle':
          store.toggleSourceMode()
          break
        case 'mode:focus:on':
          store.setFocusMode(true)
          break
        case 'mode:focus:off':
          store.setFocusMode(false)
          break
        case 'mode:typewriter:on':
          store.setTypewriterMode(true)
          break
        case 'mode:typewriter:off':
          store.setTypewriterMode(false)
          break
        case 'sidebar:toggle':
          store.toggleSidebar()
          break
        case 'editor:find':
          store.openFind(false)
          break
        case 'editor:replace':
          store.openFind(true)
          break
        case 'undo':
          ed?.chain().focus().undo().run()
          break
        case 'redo':
          ed?.chain().focus().redo().run()
          break
        case 'format:bold':
          ed?.chain().focus().toggleBold().run()
          break
        case 'format:italic':
          ed?.chain().focus().toggleItalic().run()
          break
        case 'format:underline':
          ed?.chain().focus().toggleUnderline().run()
          break
        case 'format:strike':
          ed?.chain().focus().toggleStrike().run()
          break
        case 'format:code':
          ed?.chain().focus().toggleCode().run()
          break
        case 'format:highlight':
          ed?.chain().focus().toggleHighlight().run()
          break
        case 'format:blockquote':
          ed?.chain().focus().toggleBlockquote().run()
          break
        case 'format:clear':
          ed?.chain().focus().unsetAllMarks().clearNodes().run()
          break
        case 'list:bullet':
          ed?.chain().focus().toggleBulletList().run()
          break
        case 'list:ordered':
          ed?.chain().focus().toggleOrderedList().run()
          break
        case 'list:task':
          ed?.chain().focus().toggleTaskList().run()
          break
        case 'insert:hr':
          ed?.chain().focus().setHorizontalRule().run()
          break
        case 'insert:table':
          insertTable()
          break
        case 'insert:mermaid':
          insertMermaidDiagram()
          break
        case 'insert:codeBlock':
          ed?.chain().focus().toggleCodeBlock().run()
          break
        case 'insert:snippet':
          store.openSnippetModal()
          break
        case 'insert:link':
          insertLinkFromPrompt()
          break
        case 'insert:image':
          insertImageFromPicker()
          break
        case 'insert:math':
          ed?.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: '' } }).run()
          break
        case 'heading:1':
          ed?.chain().focus().toggleHeading({ level: 1 }).run()
          break
        case 'heading:2':
          ed?.chain().focus().toggleHeading({ level: 2 }).run()
          break
        case 'heading:3':
          ed?.chain().focus().toggleHeading({ level: 3 }).run()
          break
        case 'heading:4':
          ed?.chain().focus().toggleHeading({ level: 4 }).run()
          break
        case 'heading:5':
          ed?.chain().focus().toggleHeading({ level: 5 }).run()
          break
        case 'heading:6':
          ed?.chain().focus().toggleHeading({ level: 6 }).run()
          break
        case 'heading:0':
          ed?.chain().focus().setParagraph().run()
          break
        case 'export:pdf':
          exportDocumentToPdf(await editorForExport(), tab.fileName, store.activeTheme)
          break
        case 'export:html':
          exportDocumentToHtml(await editorForExport(), tab.fileName, store.activeTheme)
          break
      }
    })

    return off
  }, [])

  useShortcuts()
}
