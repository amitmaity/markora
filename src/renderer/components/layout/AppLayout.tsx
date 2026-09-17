import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../../store/editorStore'
import { useAppActions } from '../../services/appActions'
import TitleBar from './TitleBar'
import TabBar from './TabBar'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import TyporaEditor from '../editor/TyporaEditor'

export default function AppLayout() {
  const isSidebarVisible = useEditorStore((s) => s.isSidebarVisible)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const tabIds = useEditorStore(useShallow((s) => s.tabs.map((tab) => tab.id)))
  useAppActions()

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'var(--chrome-bg)' }}>
      <div className="no-print">
        <TitleBar />
      </div>

      <div className="flex flex-1 min-h-0">
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

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: 'var(--editor-bg)' }}>
          <div className="no-print">
            <TabBar />
          </div>
          <div className="flex-1 relative min-h-0">
            {tabIds.map((id) => {
              const active = id === activeTabId
              return (
                <div
                  key={id}
                  className="absolute inset-0 flex flex-col"
                  style={{ display: active ? 'flex' : 'none' }}
                  aria-hidden={!active}
                  inert={!active}
                >
                  <TyporaEditor tabId={id} isActive={active} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="no-print">
        <StatusBar />
      </div>
    </div>
  )
}
