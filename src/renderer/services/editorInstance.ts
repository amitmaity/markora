import type { Editor } from '@tiptap/core'

/**
 * Module-level reference to the active TipTap editor instance.
 * Lets components outside the editor subtree (outline, sidebar) act on it
 * without threading the instance through props.
 */
export const editorInstance: { current: Editor | null } = { current: null }
