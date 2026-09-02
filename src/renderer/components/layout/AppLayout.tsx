import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import TyporaEditor from '../editor/TyporaEditor'

export default function AppLayout() {
  const { isSidebarVisible } = useEditorStore()

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'var(--chrome-bg)' }}>
      <div className="no-print">
        <TitleBar />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        {isSidebarVisible && (
          <div
            className="no-print flex-shrink-0 flex flex-col border-r"
            style={{
              width: 240,
              background: 'var(--sidebar-bg)',
              borderColor: 'var(--sidebar-border)',
            }}
          >
            <Sidebar />
          </div>
        )}

        {/* Editor area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: 'var(--editor-bg)' }}>
          <TyporaEditor />
        </div>
      </div>

      <div className="no-print">
        <StatusBar />
      </div>
    </div>
  )
}
