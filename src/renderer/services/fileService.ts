import { useEditorStore, getActiveTab, hasUnsavedTabs } from '../store/editorStore'
import type { FileEntry } from '../types/editor'

const api = () => window.electronAPI

export function syncWindowTitle(): void {
  const tab = getActiveTab()
  api()?.setTitle(`${tab.isDirty ? '● ' : ''}${tab.fileName} — Markora`)
}

/**
 * Returns true when it's OK to replace the current document content
 * (no unsaved changes, or the user confirmed discarding them).
 */
export function confirmDiscardChanges(action: string): boolean {
  const tab = getActiveTab()
  if (!tab.isDirty) return true
  return window.confirm(`You have unsaved changes in "${tab.fileName}". ${action}?`)
}

export function confirmAnyUnsaved(): boolean {
  if (!hasUnsavedTabs()) return true
  const dirty = useEditorStore.getState().tabs.filter((tab) => tab.isDirty)
  if (dirty.length === 1) {
    return window.confirm(`You have unsaved changes in "${dirty[0].fileName}". Close without saving?`)
  }
  return window.confirm(
    `You have unsaved changes in ${dirty.length} documents. Close without saving?`
  )
}

export async function openFile(): Promise<void> {
  const result = await api().openFileDialog()
  if (!result) return
  useEditorStore.getState().openTab(result.path, result.content)
  syncWindowTitle()
}

export async function openFolder(): Promise<void> {
  const folderPath = await api().openFolderDialog()
  if (!folderPath) return
  const tree = await api().readDir(folderPath)
  useEditorStore.getState().setWorkspace(folderPath, tree as FileEntry[])
}

export async function saveFile(): Promise<void> {
  const tab = getActiveTab()
  const { markTabSaved } = useEditorStore.getState()
  if (tab.filePath) {
    await api().writeFile(tab.filePath, tab.rawMarkdown)
    markTabSaved(tab.id)
    syncWindowTitle()
  } else {
    await saveFileAs()
  }
}

export async function saveFileAs(): Promise<void> {
  const tab = getActiveTab()
  const { setTabDocument } = useEditorStore.getState()
  const savedPath = await api().saveFileDialog(
    tab.fileName.endsWith('.md') ? tab.fileName : `${tab.fileName}.md`,
    tab.rawMarkdown
  )
  if (!savedPath) return
  setTabDocument(tab.id, savedPath, tab.rawMarkdown)
  syncWindowTitle()
}

export async function readFileByPath(filePath: string): Promise<string> {
  return api().readFile(filePath)
}

export async function openFileByPath(filePath: string): Promise<void> {
  const content = await api().readFile(filePath)
  useEditorStore.getState().openTab(filePath, content)
  syncWindowTitle()
}

export async function refreshDirectory(dirPath: string): Promise<void> {
  const tree = await api().readDir(dirPath)
  useEditorStore.getState().setFileTree(tree as FileEntry[])
}

export function closeTabWithConfirm(id?: string): boolean {
  const state = useEditorStore.getState()
  const tab = id ? state.tabs.find((t) => t.id === id) : getActiveTab()
  if (!tab) return false
  if (tab.isDirty) {
    const ok = window.confirm(`You have unsaved changes in "${tab.fileName}". Close this tab?`)
    if (!ok) return false
  }
  state.closeTab(tab.id)
  syncWindowTitle()
  return true
}

export function closeOtherTabsWithConfirm(keepId: string): boolean {
  const state = useEditorStore.getState()
  const others = state.tabs.filter((tab) => tab.id !== keepId)
  const dirty = others.filter((tab) => tab.isDirty)
  if (dirty.length > 0) {
    const ok = window.confirm(
      dirty.length === 1
        ? `You have unsaved changes in "${dirty[0].fileName}". Close it?`
        : `You have unsaved changes in ${dirty.length} other documents. Close them?`
    )
    if (!ok) return false
  }
  state.closeOtherTabs(keepId)
  syncWindowTitle()
  return true
}

export function closeAllTabsWithConfirm(): boolean {
  const state = useEditorStore.getState()
  const dirty = state.tabs.filter((tab) => tab.isDirty)
  if (dirty.length > 0) {
    const ok = window.confirm(
      dirty.length === 1
        ? `You have unsaved changes in "${dirty[0].fileName}". Close it?`
        : `You have unsaved changes in ${dirty.length} documents. Close them?`
    )
    if (!ok) return false
  }
  state.closeAllTabs()
  syncWindowTitle()
  return true
}
