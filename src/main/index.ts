import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  shell,
  nativeTheme,
  type MenuItemConstructorOptions
} from 'electron'
import { join, extname } from 'path'
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, unlinkSync } from 'fs'
import { is } from '@electron-toolkit/utils'

// Explicitly set application name
app.name = 'Markora'

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

// ---------------------------------------------------------------------------
// Recent files persistence
// ---------------------------------------------------------------------------
const userDataPath = app.getPath('userData')
const recentFilesPath = join(userDataPath, 'recent-files.json')

function loadRecentFiles(): string[] {
  try {
    const data = readFileSync(recentFilesPath, 'utf-8')
    const parsed = JSON.parse(data)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((f): f is string => typeof f === 'string')
  } catch {
    return []
  }
}

function saveRecentFiles(files: string[]): void {
  try {
    mkdirSync(userDataPath, { recursive: true })
    writeFileSync(recentFilesPath, JSON.stringify(files.slice(0, 10)))
  } catch (e) {
    console.error('Failed to save recent files', e)
  }
}

function addRecentFile(filePath: string): void {
  const recent = loadRecentFiles().filter((f) => f !== filePath)
  recent.unshift(filePath)
  saveRecentFiles(recent)
  app.addRecentDocument(filePath)
  buildMenu(getMainWindow())
}

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------
let mainWindow: BrowserWindow | null = null
// Set when quitting via Cmd+Q/app.quit() so close handlers don't fight the quit
let forceQuit = false
// macOS: file to open that arrived before the window existed
let pendingOpenFile: string | null = null

function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function openFilePath(filePath: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingOpenFile = filePath
    return
  }
  try {
    const content = readFileSync(filePath, 'utf-8')
    mainWindow.webContents.send('file:opened', { path: filePath, content })
    addRecentFile(filePath)
  } catch {
    /* ignore unreadable files */
  }
}

function createWindow(): BrowserWindow {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const win = new BrowserWindow({
    title: 'Markora',
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    show: false,
    autoHideMenuBar: false,
    icon: iconPath,
    // macOS: native traffic lights with custom draggable title bar
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
    if (is.dev) {
      win.webContents.openDevTools({ mode: 'bottom' })
    }
    // Flush a file that was queued while the window was still starting up.
    // Small delay so the renderer has mounted and registered its listeners.
    if (pendingOpenFile) {
      const p = pendingOpenFile
      pendingOpenFile = null
      setTimeout(() => openFilePath(p), 150)
    }
  })

  // Log renderer console messages to main process stdout for debugging
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    // Electron levels: 0 = verbose, 1 = info, 2 = warning, 3 = error
    const levelStr = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'][level] ?? 'INFO'
    console.log(`[Renderer ${levelStr}] ${message} (${sourceId}:${line})`)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // If the renderer died, the confirm-close handshake can never complete —
  // destroy the window so it doesn't become unclosable.
  win.webContents.on('render-process-gone', () => {
    if (!win.isDestroyed()) win.destroy()
  })

  // Track unsaved state in title
  win.on('close', (e) => {
    // Quitting: let windows close without the renderer handshake
    if (forceQuit) return
    // Renderer handles unsaved-changes prompt via IPC before this fires
    e.preventDefault()
    win.webContents.send('app:before-close')
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
  return win
}

// ---------------------------------------------------------------------------
// Native application menu
// ---------------------------------------------------------------------------
// Mirror of the renderer's UI-mode toggles so checkbox state survives menu
// rebuilds (the menu is rebuilt whenever recent files change).
const menuState = { focus: false, typewriter: false }

function buildMenu(win: BrowserWindow | null): void {
  const recentFiles = loadRecentFiles()
  const isMac = process.platform === 'darwin'
  const send = (action: string) => win?.webContents.send('menu:action', action)

  const recentItems: MenuItemConstructorOptions[] =
    recentFiles.length > 0
      ? [
          ...recentFiles.map((f) => ({
            label: baseName(f),
            click: () => {
              try {
                const content = readFileSync(f, 'utf-8')
                win?.webContents.send('file:opened', { path: f, content })
              } catch {
                dialog.showErrorBox('File not found', `Could not open: ${f}`)
              }
            }
          })),
          { type: 'separator' as const },
          {
            label: 'Clear Recent',
            click: () => {
              saveRecentFiles([])
              app.clearRecentDocuments()
              buildMenu(win)
            }
          }
        ]
      : [{ label: 'No Recent Files', enabled: false }]

  const template: MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: 'Markora',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),

    // File
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('file:new')
        },
        {
          label: 'Open File…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (!win) return
            const result = await dialog.showOpenDialog(win, {
              properties: ['openFile'],
              filters: [
                { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            })
            if (!result.canceled && result.filePaths[0]) {
              const filePath = result.filePaths[0]
              const content = readFileSync(filePath, 'utf-8')
              win.webContents.send('file:opened', { path: filePath, content })
              addRecentFile(filePath)
            }
          }
        },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            if (!win) return
            const result = await dialog.showOpenDialog(win, {
              properties: ['openDirectory']
            })
            if (!result.canceled && result.filePaths[0]) {
              win.webContents.send('folder:opened', { path: result.filePaths[0] })
            }
          }
        },
        { label: 'Open Recent', submenu: recentItems },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('file:save')
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('file:saveAs')
        },
        { type: 'separator' },
        {
          label: 'Export as PDF…',
          click: () => send('export:pdf')
        },
        {
          label: 'Export as HTML…',
          click: () => send('export:html')
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },

    // Edit
    {
      label: 'Edit',
      submenu: [
        {
          // ProseMirror manages its own history; native undo roles don't
          // integrate with it, so route through the renderer.
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => send('undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => send('redo')
        },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
        { type: 'separator' as const },
        {
          label: 'Find…',
          accelerator: 'CmdOrCtrl+F',
          click: () => send('editor:find')
        },
        {
          label: 'Find and Replace…',
          accelerator: 'CmdOrCtrl+H',
          click: () => send('editor:replace')
        }
      ]
    },

    // View
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+`',
          click: () => send('sidebar:toggle')
        },
        {
          id: 'focus-mode',
          label: 'Focus Mode',
          accelerator: 'F8',
          type: 'checkbox',
          checked: menuState.focus,
          click: (item) => {
            menuState.focus = item.checked
            win?.webContents.send('menu:action', item.checked ? 'mode:focus:on' : 'mode:focus:off')
          }
        },
        {
          id: 'typewriter-mode',
          label: 'Typewriter Mode',
          accelerator: 'F9',
          type: 'checkbox',
          checked: menuState.typewriter,
          click: (item) => {
            menuState.typewriter = item.checked
            win?.webContents.send('menu:action', item.checked ? 'mode:typewriter:on' : 'mode:typewriter:off')
          }
        },
        {
          label: 'Source Code Mode',
          accelerator: 'CmdOrCtrl+/',
          click: () => send('mode:source:toggle')
        },
        { type: 'separator' as const },
        {
          label: 'Themes',
          submenu: [
            { label: 'GitHub', click: () => win?.webContents.send('theme:set', 'github') },
            { label: 'Academic', click: () => win?.webContents.send('theme:set', 'academic') },
            { label: 'Night', click: () => win?.webContents.send('theme:set', 'night') },
            { label: 'Newsprint', click: () => win?.webContents.send('theme:set', 'newsprint') },
            { label: 'Gothic', click: () => win?.webContents.send('theme:set', 'gothic') },
            { label: 'Whitey', click: () => win?.webContents.send('theme:set', 'whitey') }
          ]
        },
        { type: 'separator' as const },
        ...(is.dev
          ? [
              { role: 'reload' as const },
              { role: 'forceReload' as const },
              { role: 'toggleDevTools' as const },
              { type: 'separator' as const }
            ]
          : []),
        { role: 'togglefullscreen' as const }
      ]
    },

    // Format
    {
      label: 'Format',
      submenu: [
        { label: 'Bold', accelerator: 'CmdOrCtrl+B', click: () => send('format:bold') },
        { label: 'Italic', accelerator: 'CmdOrCtrl+I', click: () => send('format:italic') },
        { label: 'Underline', accelerator: 'CmdOrCtrl+U', click: () => send('format:underline') },
        { label: 'Strikethrough', accelerator: 'CmdOrCtrl+Shift+X', click: () => send('format:strike') },
        { label: 'Code', accelerator: 'CmdOrCtrl+Shift+C', click: () => send('format:code') },
        { type: 'separator' as const },
        { label: 'Highlight', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('format:highlight') },
        { label: 'Insert Link', accelerator: 'CmdOrCtrl+K', click: () => send('insert:link') },
        { label: 'Insert Image', click: () => send('insert:image') },
        { label: 'Insert Math', accelerator: 'CmdOrCtrl+Shift+M', click: () => send('insert:math') },
        { label: 'Insert Table', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('insert:table') },
        { label: 'Insert Code Snippet…', accelerator: 'CmdOrCtrl+Alt+C', click: () => send('insert:snippet') },
        { label: 'Insert Code Block', accelerator: 'CmdOrCtrl+Shift+K', click: () => send('insert:codeBlock') },
        { label: 'Insert Mermaid Diagram…', accelerator: 'CmdOrCtrl+Alt+M', click: () => send('insert:mermaid') }
      ]
    },

    // Paragraph
    {
      label: 'Paragraph',
      submenu: [
        { label: 'Heading 1', accelerator: 'CmdOrCtrl+1', click: () => send('heading:1') },
        { label: 'Heading 2', accelerator: 'CmdOrCtrl+2', click: () => send('heading:2') },
        { label: 'Heading 3', accelerator: 'CmdOrCtrl+3', click: () => send('heading:3') },
        { label: 'Heading 4', accelerator: 'CmdOrCtrl+4', click: () => send('heading:4') },
        { label: 'Heading 5', accelerator: 'CmdOrCtrl+5', click: () => send('heading:5') },
        { label: 'Heading 6', accelerator: 'CmdOrCtrl+6', click: () => send('heading:6') },
        { label: 'Normal Text', accelerator: 'CmdOrCtrl+0', click: () => send('heading:0') },
        { type: 'separator' as const },
        { label: 'Code Fences', click: () => send('insert:snippet') },
        { label: 'Bullet List', click: () => send('list:bullet') },
        { label: 'Ordered List', click: () => send('list:ordered') },
        { label: 'Task List', click: () => send('list:task') },
        { label: 'Block Quote', click: () => send('format:blockquote') },
        { label: 'Horizontal Rule', click: () => send('insert:hr') }
      ]
    },

    // Window (macOS)
    ...(isMac
      ? [
          {
            label: 'Window',
            submenu: [
              { role: 'minimize' as const },
              { role: 'zoom' as const },
              { type: 'separator' as const },
              { role: 'front' as const }
            ]
          }
        ]
      : []),

    // Help
    {
      role: 'help' as const,
      submenu: [
        {
          label: 'Learn More',
          click: () => shell.openExternal('https://typora.io')
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
function registerIpcHandlers(): void {
  // Read a file by path
  ipcMain.handle('fs:readFile', async (_e, filePath: string) => {
    return readFileSync(filePath, 'utf-8')
  })

  // Write a file by path
  ipcMain.handle('fs:writeFile', async (_e, filePath: string, content: string) => {
    writeFileSync(filePath, content, 'utf-8')
    addRecentFile(filePath)
    return true
  })

  // Read directory tree
  ipcMain.handle('fs:readDir', async (_e, dirPath: string) => {
    return readDirRecursive(dirPath, dirPath)
  })

  // Open file dialog
  ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    const content = readFileSync(filePath, 'utf-8')
    addRecentFile(filePath)
    return { path: filePath, content }
  })

  // Save file dialog
  ipcMain.handle('dialog:saveFile', async (_e, defaultName: string, content: string) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) return null
    writeFileSync(result.filePath, content, 'utf-8')
    addRecentFile(result.filePath)
    return result.filePath
  })

  // Open folder dialog
  ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  // Pick an image and return it as a data URL so it renders regardless of
  // whether the renderer origin is http (dev) or file:// (packaged)
  const IMAGE_MIME: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    avif: 'image/avif',
    bmp: 'image/bmp',
    ico: 'image/x-icon'
  }
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024

  ipcMain.handle('dialog:openImage', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: Object.keys(IMAGE_MIME) },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    try {
      const stat = statSync(filePath)
      if (stat.size > MAX_IMAGE_BYTES) {
        dialog.showErrorBox('Image too large', `Images up to 10 MB are supported.\n${filePath}`)
        return null
      }
      const ext = extname(filePath).slice(1).toLowerCase()
      const mime = IMAGE_MIME[ext] ?? 'image/png'
      const dataUrl = `data:${mime};base64,${readFileSync(filePath).toString('base64')}`
      return { path: filePath, name: baseName(filePath), dataUrl }
    } catch (e) {
      console.error('Failed to read image', e)
      dialog.showErrorBox('Could not read image', filePath)
      return null
    }
  })

  // Save HTML export
  ipcMain.handle('dialog:saveHtml', async (_e, content: string) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'HTML', extensions: ['html'] }]
    })
    if (result.canceled || !result.filePath) return null
    writeFileSync(result.filePath, content, 'utf-8')
    return result.filePath
  })

  // Export PDF (isolated off-screen window for pure document rendering)
  ipcMain.handle('export:pdf', async (_e, payload: { outputPath: string; html?: string; title?: string } | string) => {
    const outputPath = typeof payload === 'string' ? payload : payload.outputPath
    const htmlContent = typeof payload === 'string' ? null : payload.html

    if (!outputPath) return null

    if (htmlContent) {
      // Create hidden off-screen window for clean rendering. Write the HTML
      // to a temp file — data: URLs hit Chromium size limits on large docs.
      const tmpHtmlPath = join(app.getPath('temp'), `markora-export-${Date.now()}.html`)
      writeFileSync(tmpHtmlPath, htmlContent, 'utf-8')
      const printWin = new BrowserWindow({
        show: false,
        width: 850,
        height: 1100,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      try {
        await printWin.loadFile(tmpHtmlPath)
        // Brief delay to ensure fonts and KaTeX math render
        await new Promise((resolve) => setTimeout(resolve, 350))

        const pdfData = await printWin.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: true
        })

        writeFileSync(outputPath, pdfData)
        return outputPath
      } finally {
        printWin.destroy()
        try {
          unlinkSync(tmpHtmlPath)
        } catch {
          /* ignore */
        }
      }
    } else if (mainWindow) {
      // Fallback
      const pdfData = await mainWindow.webContents.printToPDF({
        printBackground: true,
        margins: { marginType: 'custom', top: 1, bottom: 1, left: 1, right: 1 }
      })
      writeFileSync(outputPath, pdfData)
      return outputPath
    }
    return null
  })

  // Save PDF dialog
  ipcMain.handle('dialog:savePdf', async (_e, defaultName: string) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  // Get platform
  ipcMain.handle('app:platform', () => process.platform)

  // Get recent files
  ipcMain.handle('app:recentFiles', () => loadRecentFiles())

  // Confirm close (renderer says it's OK to close)
  ipcMain.on('app:confirm-close', () => {
    mainWindow?.destroy()
  })

  // Renderer declined to close (user kept their changes) — nothing to do,
  // the close was already prevented. Registered for symmetry/logging.
  ipcMain.on('app:cancel-close', () => {})

  // Renderer toggled focus/typewriter mode via shortcut or UI — keep the
  // native menu checkboxes in sync.
  ipcMain.on('menu:setModes', (_e, modes: { focus?: boolean; typewriter?: boolean }) => {
    menuState.focus = !!modes?.focus
    menuState.typewriter = !!modes?.typewriter
    const menu = Menu.getApplicationMenu()
    const focusItem = menu?.getMenuItemById('focus-mode')
    if (focusItem) focusItem.checked = menuState.focus
    const typewriterItem = menu?.getMenuItemById('typewriter-mode')
    if (typewriterItem) typewriterItem.checked = menuState.typewriter
  })

  // Update window title
  ipcMain.on('window:setTitle', (_e, title: string) => {
    mainWindow?.setTitle(title)
  })

  // Dark mode
  ipcMain.handle('app:isDark', () => nativeTheme.shouldUseDarkColors)
}

// ---------------------------------------------------------------------------
// Directory reading helper
// ---------------------------------------------------------------------------
interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileEntry[]
  extension?: string
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  'release',
  'coverage',
  'vendor',
  '__pycache__'
])

function readDirRecursive(dirPath: string, rootPath: string, depth = 0): FileEntry[] {
  if (depth > 6) return []
  try {
    const entries = readdirSync(dirPath)
    return entries
      .filter((name) => !name.startsWith('.') && !IGNORED_DIRS.has(name))
      .map((name) => {
        const fullPath = join(dirPath, name)
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          return {
            name,
            path: fullPath,
            type: 'directory' as const,
            children: readDirRecursive(fullPath, rootPath, depth + 1)
          }
        } else {
          const ext = name.includes('.') ? name.split('.').pop() ?? '' : ''
          return { name, path: fullPath, type: 'file' as const, extension: ext }
        }
      })
      .sort((a, b) => {
        // Directories first, then files
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  app.setName('Markora')

  // Set macOS Dock icon and about panel if running on macOS
  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({
      applicationName: 'Markora',
      applicationVersion: '1.0.0',
      copyright: '© Markora',
      credits: 'A seamless, distraction-free markdown editor'
    })
    if (app.dock) {
      try {
        app.dock.setIcon(join(__dirname, '../../resources/icon.png'))
      } catch {
        /* ignore */
      }
    }
  }

  const win = createWindow()
  registerIpcHandlers()
  buildMenu(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow()
      buildMenu(newWin)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Allow windows to close without the renderer unsaved-changes handshake
  forceQuit = true
})

app.on('open-file', (_event, filePath) => {
  // On macOS this can fire before the window exists (launch-with-file);
  // openFilePath queues it until the window is ready.
  openFilePath(filePath)
})
