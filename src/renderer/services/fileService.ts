import { useEditorStore, getActiveTab, hasUnsavedTabs } from '../store/editorStore'
import type { FileEntry } from '../types/editor'

const api = () => window.electronAPI

/** File extensions Markora opens as documents (tree, search, drag-and-drop). */
export const OPENABLE_EXTENSIONS = ['md', 'markdown', 'txt']

export function isOpenablePath(path: string): boolean {
  const name = path.split(/[\\/]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 && OPENABLE_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase())
}

/** Human-readable message from an IPC error (drops Electron's invoke prefix). */
export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}

/** Log and show an error to the user. */
export function reportError(summary: string, e: unknown): void {
  console.error(summary, e)
  window.alert(`${summary}\n\n${errorMessage(e)}`)
}

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
  let result: Awaited<ReturnType<typeof window.electronAPI.openFileDialog>>
  try {
    result = await api().openFileDialog()
  } catch (e) {
    reportError('Could not open the file.', e)
    return
  }
  if (!result) return
  useEditorStore.getState().openTab(result.path, result.content)
  syncWindowTitle()
}

export async function openFolder(): Promise<void> {
  const folderPath = await api().openFolderDialog()
  if (!folderPath) return
  try {
    const tree = await api().readDir(folderPath)
    useEditorStore.getState().setWorkspace(folderPath, tree as FileEntry[])
  } catch (e) {
    reportError('Could not read the folder.', e)
  }
}

/** Save the active tab. Returns true when the document was written. */
export async function saveFile(): Promise<boolean> {
  const tab = getActiveTab()
  if (!tab.filePath) return saveFileAs()

  // Snapshot what we write: typing during the write must stay dirty.
  const content = tab.rawMarkdown
  try {
    await api().writeFile(tab.filePath, content)
  } catch (e) {
    reportError(`Could not save "${tab.fileName}".`, e)
    return false
  }
  useEditorStore.getState().markTabSaved(tab.id, content)
  syncWindowTitle()
  return true
}

function defaultSaveName(fileName: string): string {
  return /\.(md|markdown|txt)$/i.test(fileName) ? fileName : `${fileName}.md`
}

/** Save the active tab under a new path. Returns true when written. */
export async function saveFileAs(): Promise<boolean> {
  const tab = getActiveTab()
  const content = tab.rawMarkdown
  let savedPath: string | null
  try {
    savedPath = await api().saveFileDialog(defaultSaveName(tab.fileName), content)
  } catch (e) {
    reportError(`Could not save "${tab.fileName}".`, e)
    return false
  }
  if (!savedPath) return false
  useEditorStore.getState().setTabDocument(tab.id, savedPath, content)
  syncWindowTitle()
  return true
}

export async function readFileByPath(filePath: string): Promise<string> {
  return api().readFile(filePath)
}

export async function openFileByPath(filePath: string): Promise<void> {
  let content: string
  try {
    content = await api().readFile(filePath)
  } catch (e) {
    reportError(`Could not open "${filePath.split(/[\\/]/).pop() ?? filePath}".`, e)
    return
  }
  useEditorStore.getState().openTab(filePath, content)
  syncWindowTitle()
}

export async function refreshDirectory(dirPath: string): Promise<void> {
  try {
    const tree = await api().readDir(dirPath)
    useEditorStore.getState().setFileTree(tree as FileEntry[])
  } catch (e) {
    reportError('Could not read the folder.', e)
  }
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
