import React, { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { openFileByPath, openFolder, refreshDirectory } from '../../services/fileService'
import type { FileEntry } from '../../types/editor'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Plus, RefreshCw } from 'lucide-react'

function FileNode({ entry, depth = 0 }: { entry: FileEntry; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const { filePath } = useEditorStore()
  const isActive = filePath === entry.path
  const openable = ['md', 'markdown', 'txt'].includes(entry.extension ?? '')

  if (entry.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-1 px-2 py-0.5 text-left text-xs hover:bg-black/5 transition-colors"
          style={{
            paddingLeft: `${8 + depth * 14}px`,
            color: 'var(--sidebar-text)'
          }}
        >
          <span className="flex-shrink-0 opacity-50">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className="flex-shrink-0 opacity-60">
            {expanded ? <FolderOpen size={13} /> : <Folder size={13} />}
          </span>
          <span className="truncate ml-1">{entry.name}</span>
        </button>
        {expanded && entry.children?.map((child) => (
          <FileNode key={child.path} entry={child} depth={depth + 1} />
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => openable && openFileByPath(entry.path)}
      className="w-full flex items-center gap-1.5 text-left text-xs transition-colors py-0.5"
      style={{
        paddingLeft: `${20 + depth * 14}px`,
        paddingRight: '8px',
        background: isActive ? 'var(--sidebar-active)' : 'transparent',
        color: isActive ? 'var(--sidebar-active-text, #0969da)' : 'var(--sidebar-text)',
        opacity: openable ? 1 : 0.5,
        cursor: openable ? 'pointer' : 'default'
      }}
    >
      <FileText size={12} className="flex-shrink-0 opacity-60" />
      <span className="truncate">{entry.name}</span>
    </button>
  )
}

export default function FileTree() {
  const { workspacePath, fileTree } = useEditorStore()

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-2 py-1 border-b flex-shrink-0"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <span className="text-xs font-medium opacity-60" style={{ color: 'var(--sidebar-text)' }}>
          {workspacePath ? workspacePath.split('/').pop() : 'No Folder'}
        </span>
        <div className="flex gap-1">
          <button
            onClick={openFolder}
            className="p-1 rounded hover:bg-black/10 transition-colors"
            title="Open Folder"
            style={{ color: 'var(--sidebar-text)' }}
          >
            <Plus size={13} />
          </button>
          {workspacePath && (
            <button
              onClick={() => refreshDirectory(workspacePath)}
              className="p-1 rounded hover:bg-black/10 transition-colors"
              title="Refresh"
              style={{ color: 'var(--sidebar-text)' }}
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileTree.length === 0 ? (
          <div className="px-3 py-4 text-xs opacity-40 text-center" style={{ color: 'var(--sidebar-text)' }}>
            <button onClick={openFolder} className="underline hover:opacity-70">Open a folder</button> to see files
          </div>
        ) : (
          fileTree.map((entry) => <FileNode key={entry.path} entry={entry} depth={0} />)
        )}
      </div>
    </div>
  )
}
