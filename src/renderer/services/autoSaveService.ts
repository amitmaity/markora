import { useEditorStore } from '../store/editorStore'
import { syncWindowTitle } from './fileService'

const DEBOUNCE_MS = 1500

const api = () => window.electronAPI

let timer: ReturnType<typeof setTimeout> | null = null
let saving = false

function dirtyFileTabs() {
  return useEditorStore.getState().tabs.filter((tab) => tab.isDirty && tab.filePath !== null)
}

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

async function saveDirtyTabs(): Promise<void> {
  if (saving) return
  const snapshots = dirtyFileTabs()
  if (snapshots.length === 0) return

  const writeFile = api()?.writeFile
  if (!writeFile) return

  saving = true
  try {
    let savedAny = false
    for (const snapshot of snapshots) {
      const path = snapshot.filePath
      if (!path) continue
      const content = snapshot.rawMarkdown
      try {
        await writeFile(path, content)
      } catch {
        continue
      }
      const current = useEditorStore.getState().tabs.find((tab) => tab.id === snapshot.id)
      if (current && current.filePath === path && current.rawMarkdown === content) {
        useEditorStore.getState().markTabSaved(snapshot.id)
        savedAny = true
      }
    }
    if (savedAny) syncWindowTitle()
  } finally {
    saving = false
    if (useEditorStore.getState().isAutoSaveEnabled && dirtyFileTabs().length > 0) {
      schedule(false)
    }
  }
}

function schedule(immediate: boolean): void {
  clearTimer()
  timer = setTimeout(() => {
    timer = null
    void saveDirtyTabs()
  }, immediate ? 0 : DEBOUNCE_MS)
}

/**
 * Watches the editor store and writes dirty file-backed tabs after a short
 * pause. Untitled tabs are left for a manual Save As. Returns an unsubscribe.
 */
export function initAutoSave(): () => void {
  return useEditorStore.subscribe((state, prev) => {
    if (!state.isAutoSaveEnabled) {
      clearTimer()
      return
    }

    const hasDirty = state.tabs.some((tab) => tab.isDirty && tab.filePath !== null)
    if (!hasDirty) {
      clearTimer()
      return
    }

    const justEnabled = !prev.isAutoSaveEnabled
    schedule(justEnabled)
  })
}
