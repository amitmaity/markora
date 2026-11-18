import type MarkdownIt from 'markdown-it'
import type { StateBlock, StateInline } from 'markdown-it'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * Markdown ↔ math conversion for the mathInline / mathBlock nodes.
 *
 * Syntax follows pandoc's tex_math_dollars rules:
 * - `$…$` is inline math. The opening `$` must be followed by a non-space and
 *   the closing `$` must follow a non-space and must not be followed by a
 *   digit, so `$5 and $10` stays plain text.
 * - `$$…$$` inside a paragraph is display math; on its own line(s) it is a
 *   math block.
 * - `\$` is a literal dollar sign.
 */

const isSpace = (ch: string | undefined): boolean => ch !== undefined && /\s/.test(ch)
const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9'

/** True when the character at `pos` is preceded by an odd number of backslashes */
function isEscaped(src: string, pos: number): boolean {
  let backslashes = 0
  while (pos - backslashes - 1 >= 0 && src[pos - backslashes - 1] === '\\') backslashes++
  return backslashes % 2 === 1
}

/** Index of the first unescaped `$$` at or after `from`, or -1 */
function findDoubleDollar(src: string, from: number, max: number): number {
  for (let i = src.indexOf('$$', from); i !== -1 && i + 1 < max; i = src.indexOf('$$', i + 1)) {
    if (!isEscaped(src, i)) return i
  }
  return -1
}

/** Inline math may not span lines in the saved file; LaTeX treats them as spaces anyway */
export function normalizeInlineLatex(latex: string): string {
  return latex.replace(/\s*\n\s*/g, ' ').trim()
}

type InlineScan =
  | { kind: 'math'; latex: string; display: boolean; end: number }
  // `$$` with no closing `$$`: consumed as literal text so it can't open `$…$`
  | { kind: 'literal'; end: number }

/** Scan for inline math starting at `pos` (which must hold a `$`) */
function scanInlineMath(src: string, pos: number, max: number): InlineScan | null {
  if (src[pos] !== '$') return null

  if (src[pos + 1] === '$') {
    const close = findDoubleDollar(src, pos + 2, max)
    const latex = close === -1 ? '' : src.slice(pos + 2, close).trim()
    if (!latex) return { kind: 'literal', end: pos + 2 }
    return { kind: 'math', latex: normalizeInlineLatex(latex), display: true, end: close + 2 }
  }

  if (pos + 1 >= max || isSpace(src[pos + 1])) return null
  let close = pos + 1
  while ((close = src.indexOf('$', close)) !== -1 && close < max && isEscaped(src, close)) close++
  if (close === -1 || close >= max) return null
  if (isSpace(src[close - 1]) || isDigit(src[close + 1])) return null
  return { kind: 'math', latex: normalizeInlineLatex(src.slice(pos + 1, close)), display: false, end: close + 1 }
}

function mathInlineRule(state: StateInline, silent: boolean): boolean {
  const found = scanInlineMath(state.src, state.pos, state.posMax)
  if (!found) return false
  if (!silent) {
    if (found.kind === 'literal') {
      state.pending += state.src.slice(state.pos, found.end)
    } else {
      const token = state.push('math_inline', 'math', 0)
      token.content = found.latex
      token.markup = found.display ? '$$' : '$'
    }
  }
  state.pos = found.end
  return true
}

function mathBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  // Four or more spaces of indentation make an indented code block
  if (state.sCount[startLine] - state.blkIndent >= 4) return false

  const { src } = state
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  if (start + 2 > max || src.slice(start, start + 2) !== '$$') return false

  const firstLine = src.slice(start + 2, max)
  let latex: string
  let lastLine = startLine

  const sameLineClose = findDoubleDollar(firstLine, 0, firstLine.length)
  if (sameLineClose !== -1) {
    // `$$…$$` on one line is a block only when nothing follows it; otherwise
    // it is display math inside a paragraph (handled by the inline rule)
    if (firstLine.slice(sameLineClose + 2).trim()) return false
    latex = firstLine.slice(0, sameLineClose).trim()
  } else {
    let closed = false
    for (lastLine = startLine + 1; lastLine < endLine; lastLine++) {
      const lineStart = state.bMarks[lastLine] + state.tShift[lastLine]
      const lineMax = state.eMarks[lastLine]
      // A non-empty line outdented past the container ends it (list item, quote…)
      if (lineStart < lineMax && state.sCount[lastLine] < state.blkIndent) break
      const line = src.slice(lineStart, lineMax).trimEnd()
      if (line.endsWith('$$') && !isEscaped(line, line.length - 2)) {
        closed = true
        break
      }
    }
    // An unclosed `$$` is plain text rather than swallowing the rest of the file
    if (!closed) return false

    // Like fenced code: strip the opener's indentation from the body lines
    const body = state.getLines(startLine + 1, lastLine + 1, state.sCount[startLine], false)
    const opening = firstLine.trim()
    latex = ((opening ? opening + '\n' : '') + body.slice(0, body.lastIndexOf('$$'))).replace(/\s+$/, '')
  }

  if (silent) return true

  state.line = lastLine + 1
  const token = state.push('math_block', 'math', 0)
  token.block = true
  token.content = latex
  token.markup = '$$'
  token.map = [startLine, state.line]
  return true
}

const configured = new WeakSet<MarkdownIt>()

/**
 * Teach markdown-it about `$…$` / `$$…$$`. Math renders as the elements the
 * nodes' parseHTML rules match, with the source in the `latex` attribute.
 * tiptap-markdown calls `parse.setup` before every parse, hence the guard.
 */
export function mathMarkdownItPlugin(md: MarkdownIt): void {
  if (configured.has(md)) return
  configured.add(md)

  md.inline.ruler.after('escape', 'math_inline', mathInlineRule)
  md.block.ruler.before('fence', 'math_block', mathBlockRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  })

  const attr = (value: string): string => md.utils.escapeHtml(value)
  md.renderer.rules.math_inline = (tokens, idx) => {
    const token = tokens[idx]
    const display = token.markup === '$$' ? ' data-display="true"' : ''
    return `<span data-type="math-inline" latex="${attr(token.content)}"${display}></span>`
  }
  md.renderer.rules.math_block = (tokens, idx) =>
    `<div data-type="math-block" latex="${attr(tokens[idx].content)}"></div>`
}

/** Markdown for an inline math node, or '' when it is empty */
export function inlineMathMarkdown(node: PMNode): string {
  const latex = normalizeInlineLatex(String(node.attrs.latex ?? ''))
  if (!latex) return ''
  const delimiter = node.attrs.display ? '$$' : '$'
  return delimiter + latex + delimiter
}

const isAsciiPunct = (ch: string | undefined): boolean =>
  ch !== undefined && /[!-/:-@[-`{-~]/.test(ch)

/**
 * Plain-text `$` signs that must be written as `\$` so that reopening the
 * file doesn't turn them into math (or break a neighbouring math node).
 * Keyed by child index, holding offsets into that text node.
 */
const escapeCache = new WeakMap<PMNode, Map<number, Set<number>>>()

export function dollarEscapes(parent: PMNode): Map<number, Set<number>> {
  const cached = escapeCache.get(parent)
  if (cached) return cached

  const result = new Map<number, Set<number>>()
  escapeCache.set(parent, result)

  let hasDollarText = false
  parent.forEach((child) => {
    if (child.isText && child.text?.includes('$')) hasDollarText = true
  })
  if (!hasDollarText) return result

  // Re-scan an approximation of the serialized paragraph until no plain-text
  // `$` takes part in math. Each pass escapes one more `$`, so this ends.
  const escaped = new Set<string>()
  for (;;) {
    let sim = ''
    const textDollar: Array<string | null> = [] // per sim char: "index:offset" of a text `$`
    const mathStarts = new Set<number>()
    const push = (str: string, id: string | null = null): void => {
      for (const ch of str) {
        sim += ch
        textDollar.push(ch === '$' ? id : null)
      }
    }

    parent.forEach((child, _offset, index) => {
      if (child.isText) {
        // Code spans aren't scanned for math, and the serializer doubles
        // literal backslashes so they never escape a following `$`
        if (child.marks.some((mark) => mark.type.spec.code)) return push('x')
        const text = child.text ?? ''
        for (let k = 0; k < text.length; k++) {
          const id = `${index}:${k}`
          if (text[k] === '$' && escaped.has(id)) push('\\')
          push(text[k] === '\\' ? 'x' : text[k], id)
        }
      } else if (child.type.name === 'mathInline') {
        const markdown = inlineMathMarkdown(child)
        if (markdown) mathStarts.add(sim.length)
        push(markdown)
      } else if (child.type.name === 'hardBreak') {
        push('\n')
      } else {
        push('x')
      }
    })

    let culprit: string | null = null
    const parsedStarts = new Set<number>()
    for (let i = 0; i < sim.length && !culprit; ) {
      if (sim[i] === '\\' && isAsciiPunct(sim[i + 1])) {
        i += 2
        continue
      }
      const found = sim[i] === '$' ? scanInlineMath(sim, i, sim.length) : null
      if (!found) {
        i++
        continue
      }
      if (found.kind === 'math') {
        if (textDollar[i]) culprit = textDollar[i]
        else parsedStarts.add(i)
      }
      i = found.end
    }

    // A text `$` right before a math node can swallow its opening delimiter
    if (!culprit) {
      for (const start of mathStarts) {
        if (!parsedStarts.has(start) && textDollar[start - 1]) {
          culprit = textDollar[start - 1]
          break
        }
      }
    }

    if (!culprit || escaped.has(culprit)) break
    escaped.add(culprit)
  }

  for (const id of escaped) {
    const [index, offset] = id.split(':').map(Number)
    if (!result.has(index)) result.set(index, new Set())
    result.get(index)!.add(offset)
  }
  return result
}
