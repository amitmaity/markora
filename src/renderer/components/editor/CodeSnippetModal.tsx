import React, { useState, useEffect, useRef } from 'react'
import { X, CodeXml, Check, Sparkles } from 'lucide-react'
import type { Editor } from '@tiptap/core'

interface Props {
  isOpen: boolean
  onClose: () => void
  editor: Editor | null
  isSourceMode: boolean
  rawMarkdown: string
  updateMarkdown: (md: string) => void
}

interface SnippetPreset {
  name: string
  language: string
  category: string
  code: string
}

const SNIPPET_PRESETS: SnippetPreset[] = [
  {
    name: 'Blank Code Block',
    language: 'javascript',
    category: 'General',
    code: ''
  },
  {
    name: 'JS: Async Fetch API',
    language: 'javascript',
    category: 'JavaScript',
    code: `async function fetchData(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Fetch error:', error)
    throw error
  }
}`
  },
  {
    name: 'TS: Type & Interface',
    language: 'typescript',
    category: 'TypeScript',
    code: `export interface UserProfile {
  id: string
  username: string
  email: string
  isActive: boolean
  createdAt: Date
  roles: ('admin' | 'editor' | 'viewer')[]
}`
  },
  {
    name: 'React: Functional Component',
    language: 'typescript',
    category: 'React',
    code: `import React, { useState } from 'react'

interface Props {
  initialCount?: number
}

export default function Counter({ initialCount = 0 }: Props) {
  const [count, setCount] = useState(initialCount)

  return (
    <div className="counter-container">
      <p>Current count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </div>
  )
}`
  },
  {
    name: 'Python: Function & Script',
    language: 'python',
    category: 'Python',
    code: `def process_records(records: list[dict]) -> dict:
    """Filter and calculate statistics from records."""
    valid = [r for r in records if r.get('active')]
    total = sum(r.get('value', 0) for r in valid)
    avg = total / len(valid) if valid else 0.0
    return {"count": len(valid), "total": total, "average": avg}

if __name__ == "__main__":
    sample = [{"active": True, "value": 10}, {"active": False, "value": 20}]
    print(process_records(sample))`
  },
  {
    name: 'HTML5: Modern Boilerplate',
    language: 'html',
    category: 'HTML',
    code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <main>
      <h1>Hello World</h1>
    </main>
  </body>
</html>`
  },
  {
    name: 'CSS: Flexbox Center',
    language: 'css',
    category: 'CSS',
    code: `.container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  gap: 1rem;
}`
  },
  {
    name: 'SQL: Select Query',
    language: 'sql',
    category: 'Database',
    code: `SELECT 
  u.id,
  u.email,
  COUNT(o.id) AS total_orders,
  COALESCE(SUM(o.amount), 0) AS total_spent
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email
ORDER BY total_spent DESC
LIMIT 50;`
  },
  {
    name: 'Bash: Shell Script',
    language: 'bash',
    category: 'DevOps',
    code: `#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting build process..."
BUILD_DIR="./dist"

if [ -d "$BUILD_DIR" ]; then
  rm -rf "$BUILD_DIR"
fi

mkdir -p "$BUILD_DIR"
echo "==> Build complete!"`
  },
  {
    name: 'JSON: Configuration',
    language: 'json',
    category: 'Config',
    code: `{
  "name": "my-app",
  "version": "1.0.0",
  "description": "App configuration",
  "enabled": true,
  "settings": {
    "theme": "dark",
    "timeout": 3000
  }
}`
  },
  {
    name: 'Rust: CLI Main',
    language: 'rust',
    category: 'Rust',
    code: `use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().collect();
    println!("Program arguments: {:?}", args);
    Ok(())
}`
  },
  {
    name: 'PHP: Class & API Script',
    language: 'php',
    category: 'PHP',
    code: `<?php

declare(strict_types=1);

namespace App;

/**
 * Example controller handling standard responses.
 */
class ApiResponse
{
    public function __construct(
        public readonly bool $success,
        public readonly string $message,
        public readonly array $data = []
    ) {}

    public function send(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => $this->success,
            'message' => $this->message,
            'data' => $this->data,
            'timestamp' => time(),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    }
}

// Example execution
$response = new ApiResponse(true, 'Data processed successfully', [
    'user_id' => 42,
    'status' => 'active',
]);

$response->send();`
  }
]

export default function CodeSnippetModal({
  isOpen,
  onClose,
  editor,
  isSourceMode,
  rawMarkdown,
  updateMarkdown
}: Props) {
  const [language, setLanguage] = useState('javascript')
  const [code, setCode] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string>('Blank Code Block')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSelectPreset = (preset: SnippetPreset) => {
    setSelectedPreset(preset.name)
    setLanguage(preset.language)
    setCode(preset.code)
  }

  const handleInsert = () => {
    const lang = language.trim() || 'plaintext'
    const trimmedCode = code

    if (isSourceMode) {
      // In Source Code Mode: Append or insert markdown code block
      const snippetMd = `\n\`\`\`${lang}\n${trimmedCode}\n\`\`\`\n`
      updateMarkdown(rawMarkdown ? `${rawMarkdown}\n${snippetMd}` : snippetMd)
    } else if (editor) {
      // In TipTap Mode: Insert codeBlock node
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'codeBlock',
          attrs: { language: lang },
          content: trimmedCode ? [{ type: 'text', text: trimmedCode }] : []
        })
        .run()
    }

    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd+Enter or Ctrl+Enter to submit
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleInsert()
      return
    }
    // Allow Tab key inside code textarea
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd
      const newCode = code.substring(0, start) + '  ' + code.substring(end)
      setCode(newCode)
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2
      }, 0)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col border"
        style={{
          background: 'var(--chrome-bg, #ffffff)',
          borderColor: 'var(--chrome-border, #e5e7eb)',
          color: 'var(--chrome-text, #111827)',
          maxHeight: '88vh'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b select-none"
          style={{ borderColor: 'var(--chrome-border, #e5e7eb)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded-md"
              style={{ background: 'rgba(9, 105, 218, 0.1)', color: 'var(--link-color, #0969da)' }}
            >
              <CodeXml size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Insert Code Snippet</h3>
              <p className="text-xs opacity-60">Add a syntax-highlighted code block with language & templates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-black/10 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left panel: Snippet Presets */}
          <div
            className="w-56 border-r flex flex-col p-3 overflow-y-auto flex-shrink-0"
            style={{
              borderColor: 'var(--chrome-border, #e5e7eb)',
              background: 'var(--sidebar-bg, #f9fafb)'
            }}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-60 uppercase tracking-wider mb-2">
              <Sparkles size={12} />
              <span>Presets</span>
            </div>
            <div className="flex flex-col gap-1">
              {SNIPPET_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.name
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer flex flex-col gap-0.5 ${
                      isSelected ? 'bg-black/10 font-semibold' : 'hover:bg-black/5'
                    }`}
                    style={{
                      color: isSelected
                        ? 'var(--sidebar-active-text, #0969da)'
                        : 'var(--sidebar-text, inherit)'
                    }}
                  >
                    <span>{preset.name}</span>
                    <span className="text-[10px] opacity-50 uppercase">{preset.language}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right panel: Editor & Options */}
          <div className="flex-1 flex flex-col p-4 gap-3 min-w-0 overflow-y-auto">
            {/* Language Picker */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold whitespace-nowrap opacity-80">
                Language:
              </label>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value.toLowerCase())}
                  placeholder="e.g. javascript, python, rust…"
                  className="w-full text-xs px-2.5 py-1.5 rounded border outline-none font-mono"
                  style={{
                    background: 'var(--editor-bg, #ffffff)',
                    borderColor: 'var(--chrome-border, #d1d5db)',
                    color: 'var(--text-color, inherit)'
                  }}
                />
              </div>
              <div className="flex items-center gap-1 overflow-x-auto max-w-[240px] text-[11px]">
                {['javascript', 'python', 'php', 'html', 'sql', 'bash'].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLanguage(l)}
                    className={`px-1.5 py-0.5 rounded border text-[10px] cursor-pointer ${
                      language === l ? 'font-bold' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      borderColor: 'var(--chrome-border, #d1d5db)',
                      background: language === l ? 'rgba(9, 105, 218, 0.1)' : 'transparent',
                      color: language === l ? 'var(--link-color, #0969da)' : 'inherit'
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Textarea */}
            <div className="flex-1 flex flex-col min-h-[220px]">
              <div className="flex justify-between items-center mb-1 text-xs opacity-60">
                <span>Code content (optional):</span>
                <span>Press Tab to indent</span>
              </div>
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type or paste code here… (or leave empty to create a blank code fence)"
                className="flex-1 w-full p-3 rounded-lg border outline-none font-mono text-xs leading-relaxed resize-none"
                style={{
                  background: 'var(--code-bg, #1e1e1e)',
                  color: 'var(--code-color, #d4d4d4)',
                  borderColor: 'var(--chrome-border, #374151)',
                  minHeight: 200
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 border-t text-xs select-none"
          style={{ borderColor: 'var(--chrome-border, #e5e7eb)' }}
        >
          <span className="opacity-50">
            Tip: Press <kbd className="px-1 py-0.5 rounded border text-[10px]">⌘</kbd> + <kbd className="px-1 py-0.5 rounded border text-[10px]">Enter</kbd> to insert
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded border hover:bg-black/5 transition-colors cursor-pointer"
              style={{ borderColor: 'var(--chrome-border, #d1d5db)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsert}
              className="px-4 py-1.5 rounded font-medium text-white shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              style={{ background: 'var(--sidebar-active-text, #0969da)' }}
            >
              <Check size={14} />
              <span>Insert Snippet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
