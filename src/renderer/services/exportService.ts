/**
 * Export service for generating standalone publication-ready HTML and PDF documents.
 */

interface ExportOptions {
  contentHtml: string
  title: string
  theme: string
}

export function buildExportHtml({ contentHtml, title, theme }: ExportOptions): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css" crossorigin="anonymous">
  <style>
    /* ===== Print & Export Stylesheet ===== */
    @page {
      size: A4;
      margin: 18mm 16mm;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      background: #ffffff !important;
      color: #1f2328;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 15px;
      line-height: 1.68;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .markdown-body {
      max-width: 100%;
      margin: 0 auto;
      padding: 0;
    }

    /* Spacing between blocks */
    .markdown-body > * + * {
      margin-top: 1em;
    }

    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      color: #1f2328;
      font-weight: 600;
      line-height: 1.3;
      page-break-after: avoid;
      break-after: avoid;
    }

    h1 {
      font-size: 2.1em;
      margin-top: 1.2em;
      margin-bottom: 0.5em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid #d0d7de;
    }

    h2 {
      font-size: 1.55em;
      margin-top: 1.2em;
      margin-bottom: 0.5em;
      padding-bottom: 0.25em;
      border-bottom: 1px solid #eaeef2;
    }

    h3 { font-size: 1.28em; margin-top: 1em; margin-bottom: 0.4em; }
    h4 { font-size: 1.1em; margin-top: 0.9em; margin-bottom: 0.3em; }
    h5 { font-size: 0.95em; margin-top: 0.8em; margin-bottom: 0.2em; }
    h6 { font-size: 0.85em; color: #636c76; margin-top: 0.8em; }

    /* Paragraphs */
    p {
      margin: 0.6em 0;
      word-break: break-word;
    }

    /* Inline elements */
    strong { font-weight: 600; }
    em { font-style: italic; }
    s { text-decoration: line-through; opacity: 0.7; }
    u { text-decoration: underline; }
    mark {
      background: #fff8c5;
      padding: 0.1em 0.3em;
      border-radius: 3px;
    }

    a {
      color: #0969da;
      text-decoration: none;
    }

    /* Inline Code */
    code:not(pre code) {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 0.88em;
      background: #eff1f3;
      color: #cf222e;
      padding: 0.18em 0.4em;
      border-radius: 4px;
    }

    /* Code Blocks */
    pre, .code-block-wrapper {
      page-break-inside: avoid;
      break-inside: avoid;
      margin: 1.2em 0;
    }

    pre {
      background: #1e1e1e !important;
      color: #d4d4d4 !important;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 13.5px;
      line-height: 1.55;
      padding: 14px 18px;
      border-radius: 6px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      border: 1px solid #333333;
    }

    pre code {
      font-family: inherit;
      color: inherit;
      background: transparent;
      padding: 0;
    }

    /* Syntax Highlighting (Dark background) */
    .hljs-keyword, .hljs-selector-tag, .hljs-subst { color: #ff7b72; font-weight: 500; }
    .hljs-string, .hljs-title, .hljs-section, .hljs-attribute, .hljs-literal { color: #a5d6ff; }
    .hljs-comment, .hljs-quote, .hljs-deletion { color: #8b949e; font-style: italic; }
    .hljs-number, .hljs-regexp, .hljs-link { color: #79c0ff; }
    .hljs-function, .hljs-class, .hljs-params { color: #d2a8ff; }
    .hljs-built_in, .hljs-bullet { color: #ffa657; }
    .hljs-variable, .hljs-template-variable { color: #79c0ff; }

    /* Blockquotes */
    blockquote {
      border-left: 4px solid #d0d7de;
      padding: 0.4em 1em;
      color: #57606a;
      margin: 1em 0;
      background: #f6f8fa;
      border-radius: 0 4px 4px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Lists */
    ul, ol {
      padding-left: 2em;
      margin: 0.6em 0;
    }

    li {
      margin-top: 0.25em;
    }

    li > p {
      margin: 0;
    }

    /* Task lists */
    ul[data-type="taskList"] {
      list-style: none;
      padding-left: 0.2em;
    }

    ul[data-type="taskList"] li {
      display: flex;
      align-items: flex-start;
      gap: 0.5em;
    }

    ul[data-type="taskList"] li input[type="checkbox"] {
      margin-top: 4px;
    }

    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1.2em 0;
      font-size: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    th, td {
      border: 1px solid #d0d7de;
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background: #f6f8fa;
      font-weight: 600;
    }

    tr:nth-child(even) td {
      background: #fcfcfc;
    }

    /* Horizontal Rules */
    hr {
      border: none;
      border-top: 1px solid #d0d7de;
      margin: 2em 0;
    }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      page-break-inside: avoid;
      break-inside: avoid;
      border-radius: 4px;
    }

    /* KaTeX math adjustments */
    .katex-display {
      margin: 1em 0;
      overflow-x: auto;
      overflow-y: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Hide any editor overlays, action buttons, dropdowns */
    .no-print,
    button,
    .titlebar-no-drag,
    [contenteditable="false"] > div > button,
    [contenteditable="false"] > button {
      display: none !important;
    }
  </style>
</head>
<body class="markdown-body">
  ${contentHtml}
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Extracts and cleans HTML content from the active ProseMirror editor DOM.
 */
export function getCleanDocumentHtml(editor: any): string {
  const el = document.querySelector('.editor-content .ProseMirror')
  if (!el) {
    return editor?.getHTML() ?? ''
  }

  // Clone the DOM node to avoid modifying live editor
  const clone = el.cloneNode(true) as HTMLElement

  // Remove all non-content overlay controls (copy button, language dropdown, table controls, menus)
  clone.querySelectorAll('.no-print, button, [contenteditable="false"]').forEach((node) => {
    // If it's a code block header overlay, remove it
    if (node.tagName === 'BUTTON' || node.classList.contains('no-print') || (node as HTMLElement).style.position === 'absolute') {
      node.remove()
    }
  })

  return clone.innerHTML
}

/**
 * Handles exporting document to PDF via off-screen background window.
 */
export async function exportDocumentToPdf(editor: any, fileName: string, theme: string): Promise<boolean> {
  if (!window.electronAPI) return false

  const cleanTitle = (fileName ? fileName.replace(/\.md$/, '') : 'document').trim()
  const defaultPdfName = `${cleanTitle}.pdf`

  const outputPath = await window.electronAPI.savePdfDialog(defaultPdfName)
  if (!outputPath) return false

  const contentHtml = getCleanDocumentHtml(editor)
  const fullHtml = buildExportHtml({
    contentHtml,
    title: cleanTitle,
    theme
  })

  await window.electronAPI.exportPdf({
    outputPath,
    html: fullHtml,
    title: cleanTitle
  })

  return true
}

/**
 * Handles exporting document to standalone HTML file.
 */
export async function exportDocumentToHtml(editor: any, fileName: string, theme: string): Promise<boolean> {
  if (!window.electronAPI) return false

  const cleanTitle = (fileName ? fileName.replace(/\.md$/, '') : 'document').trim()
  const contentHtml = getCleanDocumentHtml(editor)
  const fullHtml = buildExportHtml({
    contentHtml,
    title: cleanTitle,
    theme
  })

  const savedPath = await window.electronAPI.saveHtmlDialog(fullHtml)
  return savedPath !== null
}
