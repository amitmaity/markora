import { contextBridge, ipcRenderer } from 'electron'

export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileEntry[]
  extension?: string
}

export interface OpenedFile {
  path: string
  content: string
}

export interface ElectronAPI {
  // File system
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<boolean>
  readDir(dirPath: string): Promise<FileEntry[]>

  // Dialogs
  openFileDialog(): Promise<OpenedFile | null>
  saveFileDialog(defaultName: string, content: string): Promise<string | null>
  openFolderDialog(): Promise<string | null>
  saveHtmlDialog(content: string): Promise<string | null>
  savePdfDialog(defaultName: string): Promise<string | null>

  // PDF export (triggers printToPDF in main)
  exportPdf(options: { outputPath: string; html?: string; title?: string } | string): Promise<string>

  // App info
  getPlatform(): Promise<string>
  getRecentFiles(): Promise<string[]>
  isDark(): Promise<boolean>

  // Window control
  confirmClose(): void
  cancelClose(): void
  setTitle(title: string): void
  setMenuModes(modes: { focus: boolean; typewriter: boolean }): void

  // Events: main → renderer
  onMenuAction(callback: (action: string) => void): () => void
  onFileOpened(callback: (file: OpenedFile) => void): () => void
  onFolderOpened(callback: (data: { path: string }) => void): () => void
  onThemeSet(callback: (theme: string) => void): () => void
  onBeforeClose(callback: () => void): () => void
}

const api: ElectronAPI = {
  // FS
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
  readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),

  // Dialogs
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (defaultName, content) =>
    ipcRenderer.invoke('dialog:saveFile', defaultName, content),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  saveHtmlDialog: (content) => ipcRenderer.invoke('dialog:saveHtml', content),
  savePdfDialog: (defaultName) => ipcRenderer.invoke('dialog:savePdf', defaultName),

  // PDF
  exportPdf: (outputPath) => ipcRenderer.invoke('export:pdf', outputPath),

  // App info
  getPlatform: () => ipcRenderer.invoke('app:platform'),
  getRecentFiles: () => ipcRenderer.invoke('app:recentFiles'),
  isDark: () => ipcRenderer.invoke('app:isDark'),

  // Window
  confirmClose: () => ipcRenderer.send('app:confirm-close'),
  cancelClose: () => ipcRenderer.send('app:cancel-close'),
  setTitle: (title: string) => ipcRenderer.send('window:setTitle', title),
  setMenuModes: (modes: { focus: boolean; typewriter: boolean }) =>
    ipcRenderer.send('menu:setModes', modes),

  // Events (return unsubscribe functions)
  onMenuAction: (callback) => {
    const handler = (_: unknown, action: string) => callback(action)
    ipcRenderer.on('menu:action', handler)
    return () => ipcRenderer.removeListener('menu:action', handler)
  },
  onFileOpened: (callback) => {
    const handler = (_: unknown, file: OpenedFile) => callback(file)
    ipcRenderer.on('file:opened', handler)
    return () => ipcRenderer.removeListener('file:opened', handler)
  },
  onFolderOpened: (callback) => {
    const handler = (_: unknown, data: { path: string }) => callback(data)
    ipcRenderer.on('folder:opened', handler)
    return () => ipcRenderer.removeListener('folder:opened', handler)
  },
  onThemeSet: (callback) => {
    const handler = (_: unknown, theme: string) => callback(theme)
    ipcRenderer.on('theme:set', handler)
    return () => ipcRenderer.removeListener('theme:set', handler)
  },
  onBeforeClose: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('app:before-close', handler)
    return () => ipcRenderer.removeListener('app:before-close', handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
