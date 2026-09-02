import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import Focus from '@tiptap/extension-focus'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { Markdown } from 'tiptap-markdown'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { openSearchPanel, closeSearchPanel } from '@codemirror/search'
import type { EditorView } from '@codemirror/view'

import { MathInline, MathBlock } from './extensions/MathExtension'
import { MermaidBlock } from './extensions/MermaidExtension'
import { FindHighlight } from './extensions/FindHighlight'
import FloatingToolbar from './FloatingToolbar'
import SourceCodeEditor from './SourceCodeEditor'
import FindReplaceBar from './FindReplaceBar'
import TableControls from './nodes/TableControls'
import CodeBlockNodeView from './nodes/CodeBlockNodeView'
import CodeSnippetModal from './CodeSnippetModal'

import { useEditorStore } from '../../store/editorStore'
import { useShortcuts } from '../../services/shortcutRegistry'
import { editorInstance } from '../../services/editorInstance'
import { saveFile, saveFileAs, confirmDiscardChanges } from '../../services/fileService'
import { exportDocumentToPdf, exportDocumentToHtml } from '../../services/exportService'
import type { HeadingItem } from '../../types/editor'

const lowlight = createLowlight(common)

// Utility: extract headings from TipTap doc for outline
function extractHeadings(editor: any): HeadingItem[] {
  if (!editor) return []
  const headings: HeadingItem[] = []
  const { doc } = editor.state
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'heading') {
      const text = node.textContent
      const level = node.attrs.level
      const id = `heading-${pos}`
      headings.push({ level, text, id, pos })
    }
  })
  return headings
}

function getMarkdown(editor: any): string {
  return (editor.storage as any).markdown?.getMarkdown?.() ?? editor.getText()
}

const INITIAL_CONTENT = `# Welcome to Markora

Start writing in **Markdown**. All standard formatting is supported.

- Open a file with **File → Open** or **⌘O**
- Create a new document with **⌘N**
- Save with **⌘S**
- Insert Code Snippet with **⌘⌥C**

> Toggle **Source Code Mode** with ⌘/ to edit raw Markdown.
`

export default function TyporaEditor() {
  const {
    fileName,
    activeTheme,
    rawMarkdown,
    isSourceMode,
    isFocusMode,
    isTypewriterMode,
    isFindOpen,
    isSnippetModalOpen,
    openSnippetModal,
    closeSnippetModal,
    setHeadings,
    updateMarkdown,
    setDocument,
    setFocusMode,
    setTypewriterMode,
    toggleSourceMode,
    toggleSidebar,
    openFind
  } = useEditorStore()

  const editorRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isLoadingRef = useRef(false)
  // Markdown the editor last emitted (via onUpdate) — used to tell
  // "store changed because the editor typed" apart from external store changes.
  const lastEmittedRef = useRef<string | null>(null)
  // CodeMirror view while in Source Code Mode (for native CM find/replace)
  const cmViewRef = useRef<EditorView | null>(null)

  // Menu action handler from Electron
  useEffect(() => {
    if (!window.electronAPI) return
    const off = window.electronAPI.onMenuAction((action: string) => {
      const ed = editorRef.current

      switch (action) {
        case 'file:new': {
          if (confirmDiscardChanges('Create a new document and discard them')) {
            setDocument(null, '')
          }
          break
        }
        case 'file:save': saveFile(); break
        case 'file:saveAs': saveFileAs(); break
        case 'mode:source:toggle': toggleSourceMode(); break
        case 'mode:focus:on': setFocusMode(true); break
        case 'mode:focus:off': setFocusMode(false); break
        case 'mode:typewriter:on': setTypewriterMode(true); break
        case 'mode:typewriter:off': setTypewriterMode(false); break
        case 'sidebar:toggle': toggleSidebar(); break
        case 'editor:find': openFind(false); break
        case 'editor:replace': openFind(true); break
        case 'undo': ed?.chain().focus().undo().run(); break
        case 'redo': ed?.chain().focus().redo().run(); break
        case 'format:bold': ed?.chain().focus().toggleBold().run(); break
        case 'format:italic': ed?.chain().focus().toggleItalic().run(); break
        case 'format:underline': ed?.chain().focus().toggleUnderline().run(); break
        case 'format:strike': ed?.chain().focus().toggleStrike().run(); break
        case 'format:code': ed?.chain().focus().toggleCode().run(); break
        case 'format:highlight': ed?.chain().focus().toggleHighlight().run(); break
        case 'format:blockquote': ed?.chain().focus().toggleBlockquote().run(); break
        case 'list:bullet': ed?.chain().focus().toggleBulletList().run(); break
        case 'list:ordered': ed?.chain().focus().toggleOrderedList().run(); break
        case 'list:task': ed?.chain().focus().toggleTaskList().run(); break
        case 'insert:hr': ed?.chain().focus().setHorizontalRule().run(); break
        case 'insert:table': ed?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break
        case 'insert:codeBlock': ed?.chain().focus().toggleCodeBlock().run(); break
        case 'insert:snippet': openSnippetModal(); break
        case 'insert:link': {
          const url = window.prompt('Enter URL:')
          if (url) ed?.chain().focus().setLink({ href: url }).run()
          break
        }
        case 'insert:image': {
          const src = window.prompt('Enter image URL or file path:')
          if (src) ed?.chain().focus().setImage({ src }).run()
          break
        }
        case 'insert:math': ed?.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: '' } }).run(); break
        case 'heading:1': ed?.chain().focus().toggleHeading({ level: 1 }).run(); break
        case 'heading:2': ed?.chain().focus().toggleHeading({ level: 2 }).run(); break
        case 'heading:3': ed?.chain().focus().toggleHeading({ level: 3 }).run(); break
        case 'heading:4': ed?.chain().focus().toggleHeading({ level: 4 }).run(); break
        case 'heading:5': ed?.chain().focus().toggleHeading({ level: 5 }).run(); break
        case 'heading:6': ed?.chain().focus().toggleHeading({ level: 6 }).run(); break
        case 'heading:0': ed?.chain().focus().setParagraph().run(); break
        case 'export:pdf': handleExportPDF(ed); break
        case 'export:html': handleExportHTML(ed); break
      }
    })
    return off
  }, [fileName, activeTheme])

  const handleExportPDF = async (ed: any) => {
    await exportDocumentToPdf(ed, fileName, activeTheme)
  }

  const handleExportHTML = async (ed: any) => {
    await exportDocumentToHtml(ed, fileName, activeTheme)
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4, 5, 6] }
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: 'Start writing… (Markdown is supported)' }),
      Typography,
      Focus.configure({ className: 'has-focus', mode: 'deepest' }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockNodeView)
        }
      }).configure({ lowlight }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: '-',
        transformCopiedText: true,
        transformPastedText: true
      }),
      MathInline,
      MathBlock,
      MermaidBlock,
      FindHighlight
    ],
    content: INITIAL_CONTENT,
    onUpdate: ({ editor }) => {
      if (isLoadingRef.current) return
      const md = getMarkdown(editor)
      lastEmittedRef.current = md
      updateMarkdown(md)
      setHeadings(extractHeadings(editor))
    },
    onSelectionUpdate: ({ editor }) => {
      if (useEditorStore.getState().isTypewriterMode) {
        const { from } = editor.state.selection
        try {
          const domAtPos = editor.view.domAtPos(from)
          if (domAtPos.node instanceof Element) {
            domAtPos.node.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        } catch {
          // ignore
        }
      }
    }
  })

  // Store editor ref
  useEffect(() => {
    editorRef.current = editor
    editorInstance.current = editor ?? null
    return () => {
      if (editorInstance.current === editor) {
        editorInstance.current = null
        editorRef.current = null
      }
    }
  }, [editor])

  // Sync editor content with store rawMarkdown. The editor itself is the
  // source of truth while typing (onUpdate publishes to the store and
  // records what it emitted), so only external changes (file open, new
  // file, leaving source mode) are written back — otherwise every
  // keystroke would replace the whole document and throw the cursor to
  // the end.
  useEffect(() => {
    if (!editor) return

    // First run with a pristine store: publish the editor's initial
    // content to the store instead of wiping it.
    if (lastEmittedRef.current === null && rawMarkdown === '') {
      const md = getMarkdown(editor)
      lastEmittedRef.current = md
      setDocument(null, md)
      setHeadings(extractHeadings(editor))
      return
    }

    // While in Source Code Mode the rich editor is hidden; it gets
    // re-synced from the store when leaving source mode.
    if (isSourceMode) return

    if (rawMarkdown === lastEmittedRef.current) return

    isLoadingRef.current = true
    try {
      editor.commands.setContent(rawMarkdown || '', false)
    } catch {
      // ignore parse errors
    }
    isLoadingRef.current = false
    setHeadings(extractHeadings(editor))
  }, [rawMarkdown, editor, isSourceMode])

  // Keep the native menu checkboxes in sync when modes change via
  // keyboard shortcuts or title-bar buttons.
  useEffect(() => {
    window.electronAPI?.setMenuModes({ focus: isFocusMode, typewriter: isTypewriterMode })
  }, [isFocusMode, isTypewriterMode])

  // Source Code Mode uses CodeMirror's built-in search panel
  useEffect(() => {
    if (!isSourceMode) return
    const view = cmViewRef.current
    if (!view) return
    try {
      if (isFindOpen) openSearchPanel(view)
      else closeSearchPanel(view)
    } catch {
      // ignore
    }
  }, [isSourceMode, isFindOpen])

  // Register keyboard shortcuts
  useShortcuts(editorRef)

  const isTableActive = editor?.isActive('table') ?? false

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full relative"
      style={{ background: 'var(--editor-bg)' }}
    >
      {/* Table controls — shown when cursor is inside a table */}
      {!isSourceMode && isTableActive && editor && (
        <div className="flex-shrink-0">
          <TableControls editor={editor} />
        </div>
      )}

      {/* Editor area */}
      <div
        className={`flex-1 overflow-y-auto editor-content ${isFocusMode ? 'focus-mode' : ''}`}
        style={{ position: 'relative' }}
      >
        {isSourceMode ? (
          <SourceCodeEditor
            initialContent={rawMarkdown}
            onChange={(content) => updateMarkdown(content)}
            cmViewRef={cmViewRef}
          />
        ) : (
          <>
            {editor && <FloatingToolbar editor={editor} />}
            <EditorContent editor={editor} style={{ height: '100%' }} />
          </>
        )}

        {/* Find/Replace bar (rich-text mode; source mode uses CodeMirror's panel) */}
        {isFindOpen && !isSourceMode && <FindReplaceBar editor={editor} />}

        {/* Code Snippet Modal */}
        <CodeSnippetModal
          isOpen={isSnippetModalOpen}
          onClose={closeSnippetModal}
          editor={editor}
          isSourceMode={isSourceMode}
          rawMarkdown={rawMarkdown}
          updateMarkdown={updateMarkdown}
        />
      </div>
    </div>
  )
}
