import { useEditorStore } from '../store/editorStore'
import { errorMessage, syncWindowTitle } from './fileService'

const DEBOUNCE_MS = 1500

const api = () => window.electronAPI

let timer: ReturnType<typeof setTimeout> | null = null
let currentSave: Promise<void> | null = null

// Tab id → content whose write failed. A failed tab isn't retried until its
// content changes, so a read-only file doesn't loop every 1.5 s.
const failedContent = new Map<string, string>()
// Tabs already alerted about during the current failure streak.
const alertedTabs = new Set<string>()

function pendingTabs() {
  return useEditorStore
    .getState()
    .tabs.filter(
      (tab) =>
        tab.isDirty && tab.filePath !== null && failedContent.get(tab.id) !== tab.rawMarkdown
    )
}

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

async function saveDirtyTabs(): Promise<void> {
  const snapshots = pendingTabs()
  if (snapshots.length === 0) return

  const writeFile = api()?.writeFile
  if (!writeFile) return

  let savedAny = false
  const failures: string[] = []
  for (const snapshot of snapshots) {
    const path = snapshot.filePath
    if (!path) continue
    const content = snapshot.rawMarkdown
    try {
      await writeFile(path, content)
    } catch (e) {
      console.error('Auto-save failed', path, e)
      failedContent.set(snapshot.id, content)
      if (!alertedTabs.has(snapshot.id)) {
        alertedTabs.add(snapshot.id)
        failures.push(`${snapshot.fileName}: ${errorMessage(e)}`)
      }
      continue
    }
    failedContent.delete(snapshot.id)
    alertedTabs.delete(snapshot.id)
    const current = useEditorStore.getState().tabs.find((tab) => tab.id === snapshot.id)
    // Skip if the tab was closed or re-pointed (Save As) during the write
    if (current && current.filePath === path) {
      useEditorStore.getState().markTabSaved(snapshot.id, content)
      savedAny = true
    }
  }
  if (savedAny) syncWindowTitle()
  if (failures.length > 0) {
    window.alert(
      `Auto-save could not write:\n\n${failures.join('\n')}\n\n` +
        'Your changes are still open. Use Save As to keep them somewhere else.'
    )
  }
}

/** Run one save pass; concurrent callers share the pass in flight. */
function runSave(): Promise<void> {
  if (!currentSave) {
    currentSave = saveDirtyTabs().finally(() => {
      currentSave = null
      // Pick up edits made while the pass was writing
      if (useEditorStore.getState().isAutoSaveEnabled && pendingTabs().length > 0) {
        schedule(false)
      }
    })
  }
  return currentSave
}

function schedule(immediate: boolean): void {
  clearTimer()
  timer = setTimeout(
    () => {
      timer = null
      void runSave()
    },
    immediate ? 0 : DEBOUNCE_MS
  )
}

/**
 * Write any pending auto-save changes now (used before closing the window).
 * No-op when auto-save is off.
 */
export async function flushAutoSave(): Promise<void> {
  if (!useEditorStore.getState().isAutoSaveEnabled) return
  clearTimer()
  if (currentSave) await currentSave
  clearTimer()
  await runSave()
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
    // Only document changes (or turning auto-save on) matter
    if (state.tabs === prev.tabs && prev.isAutoSaveEnabled) return

    if (pendingTabs().length === 0) {
      clearTimer()
      return
    }

    const justEnabled = !prev.isAutoSaveEnabled
    schedule(justEnabled)
  })
}
