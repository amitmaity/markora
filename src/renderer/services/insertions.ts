import { useEditorStore } from '../store/editorStore'
import { editorInstance, sourceEditorInstance } from './editorInstance'

export const MERMAID_TEMPLATE = 'graph TD\n    A[Start] --> B[End]'

/**
 * Insert markdown text at the CodeMirror cursor while in Source Code Mode.
 */
function insertIntoSourceMode(markdown: string): void {
  const view = sourceEditorInstance.current
  if (view) {
    const pos = view.state.selection.main.head
    view.dispatch({ changes: { from: pos, insert: markdown } })
    view.focus()
    return
  }
  // No live CodeMirror view — fall back to appending via the store
  const { rawMarkdown, updateMarkdown } = useEditorStore.getState()
  updateMarkdown(rawMarkdown ? `${rawMarkdown}\n${markdown}` : markdown)
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
  editorInstance.current
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
  editorInstance.current
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
  editorInstance.current?.chain().focus().setImage({ src, alt }).run()
}

/**
 * Open the native image picker and insert the picked image. Falls back to a
 * URL prompt when the Electron bridge is unavailable (e.g. plain browser).
 */
export async function insertImageFromPicker(): Promise<void> {
  if (!window.electronAPI) {
    const url = window.prompt('Enter image URL:')
    if (url) insertImage(url)
    return
  }
  const picked = await window.electronAPI.openImageDialog()
  if (!picked) return
  insertImage(picked.dataUrl, picked.name)
}
