import React, { useRef, useState } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { FileText, Plus, X } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import {
  closeAllTabsWithConfirm,
  closeOtherTabsWithConfirm,
  closeTabWithConfirm
} from '../../services/fileService'

export default function TabBar() {
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const activateTab = useEditorStore((s) => s.activateTab)
  const newTab = useEditorStore((s) => s.newTab)
  const reorderTabs = useEditorStore((s) => s.reorderTabs)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current
    if (!el) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY
    }
  }

  const copyPath = async (path: string | null) => {
    if (!path) return
    try {
      await navigator.clipboard.writeText(path)
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="flex items-stretch flex-shrink-0 h-8 titlebar-no-drag"
      style={{
        background: 'var(--chrome-bg)',
        borderBottom: '1px solid var(--chrome-border)',
        color: 'var(--chrome-text)'
      }}
    >
      <div
        ref={scrollerRef}
        onWheel={onWheel}
        className="flex-1 flex items-stretch min-w-0 overflow-x-auto overflow-y-hidden"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId
          const showDropBefore = dropIndex === index && dragId !== tab.id
          return (
            <ContextMenu.Root key={tab.id}>
              <ContextMenu.Trigger asChild>
                <button
                  type="button"
                  draggable
                  onClick={() => activateTab(tab.id)}
                  onMouseDown={(e) => {
                    if (e.button === 1) e.preventDefault()
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault()
                      closeTabWithConfirm(tab.id)
                    }
                  }}
                  onDragStart={(e) => {
                    setDragId(tab.id)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('application/x-markora-tab', tab.id)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const after = e.clientX > rect.left + rect.width / 2
                    setDropIndex(after ? index + 1 : index)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const fromId = dragId || e.dataTransfer.getData('application/x-markora-tab')
                    const fromIndex = tabs.findIndex((t) => t.id === fromId)
                    let toIndex = dropIndex ?? index
                    if (fromIndex !== -1 && toIndex > fromIndex) toIndex -= 1
                    if (fromIndex !== -1) reorderTabs(fromIndex, toIndex)
                    setDragId(null)
                    setDropIndex(null)
                  }}
                  onDragEnd={() => {
                    setDragId(null)
                    setDropIndex(null)
                  }}
                  title={tab.filePath ?? tab.fileName}
                  className="relative flex items-center gap-1.5 px-2.5 max-w-[180px] min-w-[96px] h-full text-xs flex-shrink-0 cursor-pointer border-r"
                  style={{
                    background: isActive ? 'var(--editor-bg)' : 'transparent',
                    color: 'var(--chrome-text)',
                    opacity: dragId === tab.id ? 0.4 : isActive ? 1 : 0.65,
                    borderColor: 'var(--chrome-border)',
                    boxShadow: isActive ? 'inset 0 -2px 0 var(--sidebar-active-text, #0969da)' : 'none',
                    fontWeight: isActive ? 600 : 400
                  }}
                >
                  {showDropBefore && (
                    <span
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded"
                      style={{ background: 'var(--sidebar-active-text, #0969da)' }}
                    />
                  )}
                  <FileText size={12} className="flex-shrink-0 opacity-60" />
                  {tab.isDirty && (
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: 'var(--sidebar-active-text, #0969da)' }}
                    />
                  )}
                  <span className="truncate">{tab.fileName}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    title="Close"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTabWithConfirm(tab.id)
                    }}
                    className="ml-auto p-0.5 rounded hover:bg-black/10 flex-shrink-0 opacity-50 hover:opacity-100"
                  >
                    <X size={11} />
                  </span>
                </button>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content className="tabbar-context">
                  <ContextMenu.Item
                    className="tabbar-context-item"
                    onSelect={() => closeTabWithConfirm(tab.id)}
                  >
                    Close
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className="tabbar-context-item"
                    onSelect={() => closeOtherTabsWithConfirm(tab.id)}
                  >
                    Close Others
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className="tabbar-context-item"
                    onSelect={() => closeAllTabsWithConfirm()}
                  >
                    Close All
                  </ContextMenu.Item>
                  <ContextMenu.Separator className="tabbar-context-separator" />
                  <ContextMenu.Item
                    className="tabbar-context-item"
                    disabled={!tab.filePath}
                    onSelect={() => copyPath(tab.filePath)}
                  >
                    Copy Path
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          )
        })}
        {dropIndex === tabs.length && dragId && (
          <span
            className="w-0.5 self-stretch flex-shrink-0"
            style={{ background: 'var(--sidebar-active-text, #0969da)' }}
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => newTab()}
        title="New Tab (⌘T)"
        className="flex items-center justify-center w-8 flex-shrink-0 hover:bg-black/10 transition-colors cursor-pointer"
        style={{ color: 'var(--chrome-text)', borderLeft: '1px solid var(--chrome-border)' }}
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
