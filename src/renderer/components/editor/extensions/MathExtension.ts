import { InputRule, Node, mergeAttributes } from '@tiptap/core'
import Text from '@tiptap/extension-text'
import { ReactNodeViewRenderer } from '@tiptap/react'
import MathNodeView from '../nodes/MathNodeView'
import { dollarEscapes, inlineMathMarkdown, mathMarkdownItPlugin } from './mathMarkdown'

// Read `latex` verbatim: tiptap's default attribute parsing would turn
// latex="2" into the number 2
const latexAttribute = {
  default: '',
  parseHTML: (element: HTMLElement) => element.getAttribute('latex') ?? ''
}

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: latexAttribute,
      // `$$…$$` written inside a paragraph: rendered in display style
      display: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-display') === 'true',
        renderHTML: (attributes) => (attributes.display ? { 'data-display': 'true' } : {})
      }
    }
  },

  // Exposes the formula through textContent, so e.g. a table cell holding only
  // math isn't treated as empty when the table is written to markdown
  extendNodeSchema(extension) {
    return extension.name === 'mathInline' ? { leafText: (node: any) => node.attrs.latex ?? '' } : {}
  },

  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'math-inline' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView)
  },

  addInputRules() {
    const type = this.type
    return [
      // Typing the closing `$` of `$E=mc^2$` turns it into inline math
      new InputRule({
        find: /(?<![\\$])\$([^\s$](?:[^$]*[^\s$\\])?)\$$/,
        handler: ({ state, range, match }) => {
          // Atom nodes show up as placeholder text in the matched string, so
          // only convert when the match is plain text in the document; leaving
          // the transaction empty lets the `$` be typed as usual
          const typed = state.doc.textBetween(range.from, range.to, undefined, '￼')
          if (typed === match[0].slice(0, -1)) {
            state.tr.replaceWith(range.from, range.to, type.create({ latex: match[1] }))
          }
        }
      })
    ]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(inlineMathMarkdown(node))
        },
        parse: {
          setup: mathMarkdownItPlugin
        }
      }
    }
  }
})

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      latex: latexAttribute
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math-block' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView)
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const latex = String(node.attrs.latex ?? '').replace(/\s+$/, '')
          state.write('$$\n')
          if (latex) {
            state.text(latex, false)
            state.ensureNewLine()
          }
          state.write('$$')
          state.closeBlock(node)
        },
        parse: {
          setup: mathMarkdownItPlugin
        }
      }
    }
  }
})

const escapeHTML = (text: string): string => text.replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Text node whose markdown output escapes plain `$` signs (as `\$`) only
 * where they would otherwise be read back as math — currency like `$5` is
 * written unchanged. Replaces StarterKit's `text`.
 */
export const MathAwareText = Text.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any, parent: any, index: number) {
          const escapes = parent ? dollarEscapes(parent).get(index) : undefined
          if (!escapes) {
            state.text(escapeHTML(node.text))
            return
          }
          // Marks may have moved leading whitespace out of `node`
          const shift = Math.max(0, parent.child(index).text.indexOf(node.text))
          const text: string = node.text
          let from = 0
          for (let i = 0; i < text.length; i++) {
            if (text[i] !== '$' || !escapes.has(i + shift)) continue
            if (i > from) state.text(escapeHTML(text.slice(from, i)))
            state.write('\\$')
            state.atBlockStart = false
            from = i + 1
          }
          if (from < text.length) state.text(escapeHTML(text.slice(from)))
        },
        parse: {
          // handled by markdown-it
        }
      }
    }
  }
})
