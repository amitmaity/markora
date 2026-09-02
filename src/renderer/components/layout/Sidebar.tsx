import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import FileTree from '../sidebar/FileTree'
import OutlineView from '../sidebar/OutlineView'
import SearchPanel from '../sidebar/SearchPanel'
import { Files, List, Search } from 'lucide-react'

export default function Sidebar() {
  const { sidebarTab, setSidebarTab } = useEditorStore()

  const tabs = [
    { id: 'files' as const, icon: Files, label: 'Files' },
    { id: 'outline' as const, icon: List, label: 'Outline' },
    { id: 'search' as const, icon: Search, label: 'Search' }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Tab icons */}
      <div
        className="flex flex-shrink-0 border-b"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setSidebarTab(id)}
            title={label}
            className="flex-1 flex items-center justify-center h-9 transition-colors"
            style={{
              color: sidebarTab === id ? 'var(--sidebar-active-text, #0969da)' : 'var(--sidebar-text)',
              background: sidebarTab === id ? 'var(--sidebar-active)' : 'transparent',
              opacity: sidebarTab === id ? 1 : 0.6
            }}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {sidebarTab === 'files' && <FileTree />}
        {sidebarTab === 'outline' && <OutlineView />}
        {sidebarTab === 'search' && <SearchPanel />}
      </div>
    </div>
  )
}
