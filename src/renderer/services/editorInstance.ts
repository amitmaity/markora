import type { Editor } from '@tiptap/core'
import type { EditorView } from '@codemirror/view'
import { useEditorStore } from '../store/editorStore'

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

/**
 * The active TipTap editor, or null while Source Code Mode is on.
 *
 * In Source Code Mode the TipTap editor stays alive but hidden with stale
 * content (it is only re-synced when leaving Source Mode). Running a command
 * on it would emit that stale markdown and overwrite the user's source edits,
 * so every rich-text action must go through this instead of
 * `editorInstance.current`.
 */
export function richEditor(): Editor | null {
  return useEditorStore.getState().isSourceMode ? null : editorInstance.current
}
