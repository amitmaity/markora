import { useEffect, useRef } from 'react'
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
import { editorInstance, sourceEditorInstance } from '../../services/editorInstance'
import type { HeadingItem } from '../../types/editor'

const lowlight = createLowlight(common)

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

interface Props {
  tabId: string
  isActive: boolean
}

export default function TyporaEditor({ tabId, isActive }: Props) {
  const rawMarkdown = useEditorStore((s) => s.tabs.find((t) => t.id === tabId)?.rawMarkdown ?? '')
  const isSourceMode = useEditorStore((s) => s.isSourceMode)
  const isFocusMode = useEditorStore((s) => s.isFocusMode)
  const isTypewriterMode = useEditorStore((s) => s.isTypewriterMode)
  const isFindOpen = useEditorStore((s) => s.isFindOpen)
  const isSnippetModalOpen = useEditorStore((s) => s.isSnippetModalOpen)
  const closeSnippetModal = useEditorStore((s) => s.closeSnippetModal)

  const containerRef = useRef<HTMLDivElement>(null)
  const isLoadingRef = useRef(false)
  const lastEmittedRef = useRef<string | null>(null)

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
      Image.configure({ allowBase64: true }),
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
    content: rawMarkdown || '',
    onCreate: ({ editor: created }) => {
      const md = getMarkdown(created)
      lastEmittedRef.current = md
      useEditorStore.getState().reconcileTabMarkdown(tabId, md)
      useEditorStore.getState().setTabHeadings(tabId, extractHeadings(created))
    },
    onUpdate: ({ editor: current }) => {
      if (isLoadingRef.current) return
      const md = getMarkdown(current)
      lastEmittedRef.current = md
      useEditorStore.getState().updateTabMarkdown(tabId, md)
      useEditorStore.getState().setTabHeadings(tabId, extractHeadings(current))
    },
    onSelectionUpdate: ({ editor: current }) => {
      if (useEditorStore.getState().isTypewriterMode) {
        const { from } = current.state.selection
        try {
          const domAtPos = current.view.domAtPos(from)
          if (domAtPos.node instanceof Element) {
            domAtPos.node.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        } catch {
          // ignore
        }
      }
    }
  })

  useEffect(() => {
    if (!editor) return
    if (isActive) {
      editorInstance.current = editor
    } else if (editorInstance.current === editor) {
      editorInstance.current = null
    }
    return () => {
      if (editorInstance.current === editor) {
        editorInstance.current = null
      }
    }
  }, [editor, isActive])

  useEffect(() => {
    if (!editor) return
    if (isSourceMode) return
    if (rawMarkdown === lastEmittedRef.current) return

    isLoadingRef.current = true
    try {
      editor.commands.setContent(rawMarkdown || '', false)
      lastEmittedRef.current = getMarkdown(editor)
    } catch {
      lastEmittedRef.current = rawMarkdown
    }
    isLoadingRef.current = false
    useEditorStore.getState().setTabHeadings(tabId, extractHeadings(editor))
  }, [rawMarkdown, editor, isSourceMode, tabId])

  useEffect(() => {
    if (!isActive) return
    window.electronAPI?.setMenuModes({ focus: isFocusMode, typewriter: isTypewriterMode })
  }, [isFocusMode, isTypewriterMode, isActive])

  useEffect(() => {
    if (!isActive || !isSourceMode) return
    const view = sourceEditorInstance.current
    if (!view) return
    try {
      if (isFindOpen) openSearchPanel(view)
      else closeSearchPanel(view)
    } catch {
      // ignore
    }
  }, [isSourceMode, isFindOpen, isActive])

  useEffect(() => {
    if (!isActive || !editor || isSourceMode || isFindOpen) return
    editor.commands.focus()
  }, [isActive, editor, isSourceMode, isFindOpen])

  const isTableActive = isActive && (editor?.isActive('table') ?? false)

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full relative"
      style={{ background: 'var(--editor-bg)' }}
    >
      {!isSourceMode && isTableActive && editor && (
        <div className="flex-shrink-0">
          <TableControls editor={editor} />
        </div>
      )}

      <div
        className={`flex-1 overflow-y-auto editor-content ${isFocusMode ? 'focus-mode' : ''}`}
        style={{ position: 'relative' }}
      >
        {isSourceMode && isActive ? (
          <SourceCodeEditor
            initialContent={rawMarkdown}
            onChange={(content) => useEditorStore.getState().updateTabMarkdown(tabId, content)}
          />
        ) : (
          <>
            {isActive && editor && <FloatingToolbar editor={editor} />}
            <EditorContent editor={editor} style={{ height: '100%' }} />
          </>
        )}

        {isFindOpen && !isSourceMode && isActive && <FindReplaceBar editor={editor} />}

        {isActive && (
          <CodeSnippetModal
            isOpen={isSnippetModalOpen}
            onClose={closeSnippetModal}
            editor={editor}
            isSourceMode={isSourceMode}
            rawMarkdown={rawMarkdown}
            updateMarkdown={(md) => useEditorStore.getState().updateTabMarkdown(tabId, md)}
          />
        )}
      </div>
    </div>
  )
}
