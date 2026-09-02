import React, { useState, useMemo } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { openFileByPath } from '../../services/fileService'
import type { FileEntry } from '../../types/editor'
import { FileText, Search } from 'lucide-react'

function flattenTree(entries: FileEntry[]): FileEntry[] {
  const result: FileEntry[] = []
  function walk(items: FileEntry[]) {
    for (const item of items) {
      if (item.type === 'file') result.push(item)
      if (item.children) walk(item.children)
    }
  }
  walk(entries)
  return result
}

export default function SearchPanel() {
  const { fileTree } = useEditorStore()
  const [query, setQuery] = useState('')

  const allFiles = useMemo(() => flattenTree(fileTree), [fileTree])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return allFiles
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 30)
  }, [query, allFiles])

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--sidebar-border)' }}>
        <div className="flex items-center gap-1.5 rounded px-2 py-1" style={{ background: 'var(--sidebar-hover)' }}>
          <Search size={12} style={{ color: 'var(--sidebar-text)', opacity: 0.5 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className="flex-1 bg-transparent text-xs outline-none border-none"
            style={{ color: 'var(--sidebar-text)' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query && results.length === 0 && (
          <div className="px-3 py-3 text-xs opacity-40 text-center" style={{ color: 'var(--sidebar-text)' }}>
            No files found
          </div>
        )}
        {results.map((file) => (
          <button
            key={file.path}
            onClick={() => openFileByPath(file.path)}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 transition-colors flex items-center gap-2"
            style={{ color: 'var(--sidebar-text)' }}
          >
            <FileText size={12} className="flex-shrink-0 opacity-50" />
            <span className="truncate">{file.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
