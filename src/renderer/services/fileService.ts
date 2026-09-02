import { useEditorStore } from '../store/editorStore'
import type { FileEntry } from '../types/editor'

const api = () => window.electronAPI

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

/**
 * Returns true when it's OK to replace the current document content
 * (no unsaved changes, or the user confirmed discarding them).
 */
export function confirmDiscardChanges(action: string): boolean {
  const { isDirty } = useEditorStore.getState()
  if (!isDirty) return true
  return window.confirm(`You have unsaved changes. ${action}?`)
}

export async function openFile(): Promise<void> {
  const result = await api().openFileDialog()
  if (!result) return
  if (!confirmDiscardChanges('Open the selected file and discard them')) return
  useEditorStore.getState().setDocument(result.path, result.content)
  api().setTitle(`${baseName(result.path)} — Markora`)
}

export async function openFolder(): Promise<void> {
  const folderPath = await api().openFolderDialog()
  if (!folderPath) return
  const tree = await api().readDir(folderPath)
  useEditorStore.getState().setWorkspace(folderPath, tree as FileEntry[])
}

export async function saveFile(): Promise<void> {
  const { filePath, rawMarkdown, markSaved, fileName } = useEditorStore.getState()
  if (filePath) {
    await api().writeFile(filePath, rawMarkdown)
    markSaved()
    api().setTitle(`${fileName} — Markora`)
  } else {
    await saveFileAs()
  }
}

export async function saveFileAs(): Promise<void> {
  const { rawMarkdown, setDocument, fileName } = useEditorStore.getState()
  const savedPath = await api().saveFileDialog(fileName.endsWith('.md') ? fileName : `${fileName}.md`, rawMarkdown)
  if (!savedPath) return
  setDocument(savedPath, rawMarkdown)
  useEditorStore.getState().markSaved()
  api().setTitle(`${baseName(savedPath)} — Markora`)
}

export async function readFileByPath(filePath: string): Promise<string> {
  return api().readFile(filePath)
}

export async function openFileByPath(filePath: string): Promise<void> {
  if (!confirmDiscardChanges('Open the selected file and discard them')) return
  const content = await api().readFile(filePath)
  useEditorStore.getState().setDocument(filePath, content)
  api().setTitle(`${baseName(filePath)} — Markora`)
}

export async function refreshDirectory(dirPath: string): Promise<void> {
  const tree = await api().readDir(dirPath)
  useEditorStore.getState().setFileTree(tree as FileEntry[])
}
