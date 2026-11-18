import { useEffect } from 'react'
import { useEditorStore } from './store/editorStore'
import AppLayout from './components/layout/AppLayout'
import ErrorBoundary from './components/common/ErrorBoundary'
import { applyTheme, getStoredTheme, ALL_THEMES } from './themes/themeManager'
import { confirmAnyUnsaved, isOpenablePath, openFileByPath, reportError } from './services/fileService'
import { flushAutoSave } from './services/autoSaveService'
import type { FileEntry, ThemeName } from './types/editor'

// Theme CSS imports
import './themes/github.css'
import './themes/academic.css'
import './themes/night.css'
import './themes/newsprint.css'
import './themes/gothic.css'
import './themes/whitey.css'

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

export default function App() {
  // Selectors, not the whole store: App re-rendering cascades into every
  // tab's editor, so it must not re-render on each keystroke.
  const activeTheme = useEditorStore((s) => s.activeTheme)

  // Initialize theme from localStorage (applyTheme is handled by the
  // activeTheme effect below; main.tsx already applied it pre-render)
  useEffect(() => {
    useEditorStore.getState().setTheme(getStoredTheme())
  }, [])

  // Apply theme when it changes
  useEffect(() => {
    applyTheme(activeTheme)
  }, [activeTheme])

  // Open markdown files dropped anywhere on the window. Without this the
  // browser default would navigate the whole app to the dropped file.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      const getPath = window.electronAPI?.getPathForFile
      if (!getPath) return
      for (const file of Array.from(e.dataTransfer?.files ?? [])) {
        const path = getPath(file)
        if (path && isOpenablePath(path)) void openFileByPath(path)
      }
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  // Electron IPC event listeners
  useEffect(() => {
    if (!window.electronAPI) return
    const { setRecentFiles, setWorkspace, setTheme } = useEditorStore.getState()

    // Load recent files
    window.electronAPI.getRecentFiles().then(setRecentFiles)

    // File opened from the menu, recent list, Finder, or a dropped link
    const offFile = window.electronAPI.onFileOpened(({ path, content }) => {
      useEditorStore.getState().openTab(path, content)
    })

    // Folder opened from menu
    const offFolder = window.electronAPI.onFolderOpened(async ({ path }) => {
      try {
        const tree = await window.electronAPI.readDir(path)
        setWorkspace(path, tree as FileEntry[])
      } catch (e) {
        reportError('Could not read the folder.', e)
      }
    })

    // Theme set from menu
    const offTheme = window.electronAPI.onThemeSet((theme) => {
      if (ALL_THEMES.includes(theme as ThemeName)) setTheme(theme as ThemeName)
    })

    // Before close or quit — write pending auto-saves, then ask about
    // anything still unsaved
    const offClose = window.electronAPI.onBeforeClose(async () => {
      try {
        await flushAutoSave()
      } catch (e) {
        console.error('Auto-save flush failed', e)
      }
      if (!confirmAnyUnsaved()) {
        window.electronAPI.cancelClose()
        return
      }
      window.electronAPI.confirmClose()
    })

    // Listeners are registered: main can now deliver queued messages
    // (e.g. a file opened from Finder at launch)
    window.electronAPI.notifyReady()

    return () => {
      offFile()
      offFolder()
      offTheme()
      offClose()
    }
  }, [])

  return (
    <ErrorBoundary>
      <AppLayout />
    </ErrorBoundary>
  )
}
