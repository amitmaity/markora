import { useEditorStore, getActiveTab } from '../store/editorStore'
import { richEditor, sourceEditorInstance } from './editorInstance'
import { askText } from './textPrompt'

export const MERMAID_TEMPLATE = 'graph TD\n    A[Start] --> B[End]'

/**
 * Insert markdown text at the CodeMirror cursor while in Source Code Mode.
 */
export function insertIntoSourceMode(markdown: string): void {
  const view = sourceEditorInstance.current
  if (view) {
    const pos = view.state.selection.main.head
    view.dispatch({ changes: { from: pos, insert: markdown } })
    view.focus()
    return
  }
  const tab = getActiveTab()
  useEditorStore.getState().updateTabMarkdown(
    tab.id,
    tab.rawMarkdown ? `${tab.rawMarkdown}\n${markdown}` : markdown
  )
}

function sanitizeCount(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 1 && value <= 100 ? Math.floor(value) : fallback
}

export function insertTable(rows = 3, cols = 3): void {
  const rowCount = sanitizeCount(rows, 3)
  const colCount = sanitizeCount(cols, 3)
  const { isSourceMode } = useEditorStore.getState()
  if (isSourceMode) {
    const header = `| ${Array.from({ length: colCount }, (_, i) => `Header ${i + 1}`).join(' | ')} |`
    const divider = `| ${Array.from({ length: colCount }, () => '---').join(' | ')} |`
    const body = Array.from({ length: Math.max(rowCount - 1, 0) }, () =>
      `| ${Array.from({ length: colCount }, () => '  ').join(' | ')} |`
    ).join('\n')
    insertIntoSourceMode(`\n${header}\n${divider}\n${body}\n`)
    return
  }
  richEditor()
    ?.chain()
    .focus()
    .insertTable({ rows: rowCount, cols: colCount, withHeaderRow: true })
    .run()
}

export function insertMermaidDiagram(): void {
  const { isSourceMode } = useEditorStore.getState()
  if (isSourceMode) {
    insertIntoSourceMode(`\n\`\`\`mermaid\n${MERMAID_TEMPLATE}\n\`\`\`\n`)
    return
  }
  richEditor()
    ?.chain()
    .focus()
    .insertContent({ type: 'mermaidBlock', attrs: { code: MERMAID_TEMPLATE } })
    .run()
}

/**
 * Insert an image node (rich mode) or markdown image (source mode).
 */
export function insertImage(src: string, alt = 'image'): void {
  const { isSourceMode } = useEditorStore.getState()
  if (isSourceMode) {
    insertIntoSourceMode(`![${alt}](${src})\n`)
    return
  }
  richEditor()?.chain().focus().setImage({ src, alt }).run()
}

/**
 * Open the native image picker and insert the picked image. Falls back to a
 * URL prompt when the Electron bridge is unavailable (e.g. plain browser).
 */
export async function insertImageFromPicker(): Promise<void> {
  if (!window.electronAPI) {
    const url = await askText('Insert Image', { label: 'Image URL', placeholder: 'https://' })
    if (url?.trim()) insertImage(url.trim())
    return
  }
  let picked: Awaited<ReturnType<typeof window.electronAPI.openImageDialog>>
  try {
    picked = await window.electronAPI.openImageDialog()
  } catch (e) {
    console.error('Image picker failed', e)
    return
  }
  if (!picked) return
  insertImage(picked.dataUrl, picked.name)
}

/**
 * Ask for a URL and link the selection (or insert the URL as a link when
 * nothing is selected). Editing an existing link pre-fills its URL; clearing
 * the field removes the link.
 */
export async function insertLinkFromPrompt(): Promise<void> {
  if (useEditorStore.getState().isSourceMode) {
    const view = sourceEditorInstance.current
    const url = (await askText('Insert Link', { label: 'URL', placeholder: 'https://' }))?.trim()
    if (!url) return
    if (view) {
      const { from, to } = view.state.selection.main
      const text = view.state.sliceDoc(from, to) || url
      view.dispatch({ changes: { from, to, insert: `[${text}](${url})` } })
      view.focus()
    } else {
      insertIntoSourceMode(`[${url}](${url})`)
    }
    return
  }

  const editor = richEditor()
  if (!editor) return
  const current = (editor.getAttributes('link').href as string | undefined) ?? ''
  const input = await askText(current ? 'Edit Link' : 'Insert Link', {
    label: 'URL',
    defaultValue: current,
    placeholder: 'https://'
  })
  if (input === null) return
  const href = input.trim()

  if (!href) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  if (editor.state.selection.empty && !editor.isActive('link')) {
    editor
      .chain()
      .focus()
      .insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] })
      .run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
}
