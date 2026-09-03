import type { Editor } from '@tiptap/core'
import type { EditorView } from '@codemirror/view'

/**
 * Module-level reference to the active TipTap editor instance.
 * Lets components outside the editor subtree (outline, sidebar, title bar)
 * act on it without threading the instance through props.
 */
export const editorInstance: { current: Editor | null } = { current: null }

/**
 * Reference to the CodeMirror view while Source Code Mode is active, so
 * insertions can go at the cursor.
 */
export const sourceEditorInstance: { current: EditorView | null } = { current: null }
