import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'

export const FindPluginKey = new PluginKey<DecorationSet>('findHighlight')

/**
 * ProseMirror plugin that renders find/replace match highlights.
 * FindReplaceBar pushes DecorationSets via the plugin key meta; without new
 * meta the decorations follow doc changes through transaction mapping.
 */
export const FindHighlight = Extension.create({
  name: 'findHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: FindPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, value) {
            const meta = tr.getMeta(FindPluginKey)
            if (meta !== undefined) return meta
            if (!value || value === DecorationSet.empty || !tr.docChanged) return value
            return value.map(tr.mapping, tr.doc)
          }
        },
        props: {
          decorations(state) {
            return FindPluginKey.getState(state)
          }
        }
      })
    ]
  }
})
