import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import MermaidNodeView from '../nodes/MermaidNodeView'

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      code: {
        default: '',
        // The diagram source lives in the node view, not in the DOM output
        parseHTML: (element) => element.textContent ?? '',
        renderHTML: () => ({})
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView)
  },

  addStorage() {
    return {
      markdown: {
        // tiptap-markdown hooks: serialize the node back to a fenced block
        // and claim ```mermaid fences when parsing markdown
        serialize(state: any, node: any) {
          state.write('```mermaid\n')
          state.text(node.attrs.code || '', false)
          state.ensureNewLine()
          state.write('```')
          state.closeBlock(node)
        },
        parse: {
          updateDOM(element: HTMLElement) {
            // markdown-it renders ```mermaid fences as
            // <pre><code class="language-mermaid"> — convert them so this
            // node's parseHTML rule picks them up instead of codeBlock
            element.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
              const pre = code.parentElement
              if (!pre) return
              const div = document.createElement('div')
              div.setAttribute('data-type', 'mermaid')
              div.textContent = code.textContent ?? ''
              pre.replaceWith(div)
            })
          }
        }
      }
    }
  }
})
