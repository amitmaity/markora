import React, { useState, useRef } from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { Check, Copy, ChevronDown } from 'lucide-react'

const LANGUAGES = [
  'plaintext', 'javascript', 'typescript', 'jsx', 'tsx', 'python', 'rust', 'go',
  'java', 'c', 'cpp', 'csharp', 'php', 'ruby', 'swift', 'kotlin', 'scala',
  'html', 'css', 'scss', 'json', 'yaml', 'toml', 'xml', 'sql', 'graphql',
  'bash', 'sh', 'powershell', 'dockerfile', 'markdown', 'r', 'matlab',
  'haskell', 'elixir', 'erlang', 'clojure', 'dart', 'lua', 'vim'
]

interface Props {
  node: { attrs: { language: string | null } }
  updateAttributes: (attrs: Record<string, unknown>) => void
  extension: any
}

export default function CodeBlockNodeView({ node, updateAttributes }: Props) {
  const [copied, setCopied] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [langSearch, setLangSearch] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  const language = node.attrs.language || 'plaintext'
  const filteredLangs = LANGUAGES.filter((l) =>
    l.toLowerCase().includes(langSearch.toLowerCase())
  )

  const handleCopy = async () => {
    const text = contentRef.current?.innerText ?? ''
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <NodeViewWrapper className="code-block-wrapper" style={{ position: 'relative', margin: '1em 0' }}>
      <pre
        style={{
          background: 'var(--pre-bg, #1e1e1e)',
          borderRadius: 8,
          padding: '1em 1.25em',
          overflowX: 'auto',
          margin: 0,
          position: 'relative'
        }}
      >
        {/* Language selector + copy — top-right overlay */}
        <div
          contentEditable={false}
          className="no-print"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 4,
            zIndex: 10
          }}
        >
          {/* Language selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowLangMenu((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.1)',
                color: '#aaa',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              {language}
              <ChevronDown size={10} />
            </button>
            {showLangMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 2,
                  width: 140,
                  maxHeight: 200,
                  overflowY: 'auto',
                  background: '#2d2d2d',
                  border: '1px solid #444',
                  borderRadius: 6,
                  zIndex: 20
                }}
              >
                <input
                  type="text"
                  value={langSearch}
                  onChange={(e) => setLangSearch(e.target.value)}
                  placeholder="Filter…"
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #444',
                    color: '#eee',
                    fontSize: 11,
                    outline: 'none'
                  }}
                />
                {filteredLangs.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      updateAttributes({ language: lang })
                      setShowLangMenu(false)
                      setLangSearch('')
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '4px 8px',
                      textAlign: 'left',
                      background: lang === language ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: '#ccc',
                      fontSize: 11,
                      cursor: 'pointer',
                      border: 'none'
                    }}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.1)',
              color: copied ? '#4ade80' : '#aaa',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </div>

        <div ref={contentRef}>
          <NodeViewContent as="code" />
        </div>
      </pre>
    </NodeViewWrapper>
  )
}
