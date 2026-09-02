import React, { useEffect } from 'react'
import { useEditorStore } from './store/editorStore'
import AppLayout from './components/layout/AppLayout'
import ErrorBoundary from './components/common/ErrorBoundary'
import { applyTheme, getStoredTheme } from './themes/themeManager'
import { confirmDiscardChanges } from './services/fileService'
import type { FileEntry } from './types/editor'

// Theme CSS imports
import './themes/github.css'
import './themes/academic.css'
import './themes/night.css'
import './themes/newsprint.css'
import './themes/gothic.css'
import './themes/whitey.css'

export default function App() {
  const { setTheme, activeTheme, setRecentFiles, setWorkspace } = useEditorStore()

  // Initialize theme from localStorage (applyTheme is handled by the
  // activeTheme effect below; main.tsx already applied it pre-render)
  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

  // Apply theme when it changes
  useEffect(() => {
    applyTheme(activeTheme)
  }, [activeTheme])

  // Electron IPC event listeners
  useEffect(() => {
    if (!window.electronAPI) return

    // Load recent files
    window.electronAPI.getRecentFiles().then(setRecentFiles)

    // File opened from menu, recent list, or drag
    const offFile = window.electronAPI.onFileOpened(async ({ path, content }) => {
      if (!confirmDiscardChanges('Open the selected file and discard them')) return
      useEditorStore.getState().setDocument(path, content)
    })

    // Folder opened from menu
    const offFolder = window.electronAPI.onFolderOpened(async ({ path }) => {
      const tree = await window.electronAPI.readDir(path)
      setWorkspace(path, tree as FileEntry[])
    })

    // Theme set from menu
    const offTheme = window.electronAPI.onThemeSet((theme) => {
      setTheme(theme as any)
    })

    // Before close — check for dirty state
    const offClose = window.electronAPI.onBeforeClose(() => {
      const { isDirty } = useEditorStore.getState()
      if (!isDirty) {
        window.electronAPI.confirmClose()
        return
      }
      // Show native confirm dialog
      const choice = window.confirm('You have unsaved changes. Close without saving?')
      if (choice) {
        window.electronAPI.confirmClose()
      } else {
        window.electronAPI.cancelClose()
      }
    })

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
