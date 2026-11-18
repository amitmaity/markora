import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  net,
  shell,
  nativeTheme,
  type MenuItemConstructorOptions
} from 'electron'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, unlinkSync } from 'fs'
import { is } from '@electron-toolkit/utils'

// Explicitly set application name
app.name = 'Markora'

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'txt'])
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

function isMarkdownPath(p: string): boolean {
  return MARKDOWN_EXTENSIONS.has(extname(p).slice(1).toLowerCase())
}

/**
 * Route a URL the renderer tried to navigate to or open. Local markdown files
 * open as tabs, web/mail links go to the OS, and everything else (other
 * schemes, other local files) is dropped so a link can never launch an
 * arbitrary handler or replace the app page.
 */
function openUrlSafely(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return
  }
  if (parsed.protocol === 'file:') {
    try {
      const filePath = fileURLToPath(parsed)
      if (isMarkdownPath(filePath)) openFilePath(filePath)
    } catch {
      /* malformed file URL */
    }
    return
  }
  if (EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
    void shell.openExternal(url)
  }
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
  const current = loadRecentFiles()
  // Saves (including auto-save every few seconds) hit this path; skip the
  // disk write and native menu rebuild when nothing would change.
  if (current[0] === filePath) return
  saveRecentFiles([filePath, ...current.filter((f) => f !== filePath)])
  app.addRecentDocument(filePath)
  buildMenu()
}

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------
let mainWindow: BrowserWindow | null = null
// True once the renderer has registered its IPC listeners (renderer:ready).
let rendererReady = false
// Messages for the renderer that arrived before it was ready (e.g. macOS
// open-file at launch, or a menu action while no window was open).
const pendingMessages: Array<{ channel: string; args: unknown[] }> = []
// Set once the renderer approved quitting (or there was nothing to ask), so
// window close handlers stop intercepting.
let quitConfirmed = false
// A quit is waiting on the renderer's unsaved-changes answer.
let pendingQuit = false
// A close/quit request is already showing the renderer's prompt.
let awaitingRendererAnswer = false

function getLiveWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

function getOrCreateWindow(): BrowserWindow {
  return getLiveWindow() ?? createWindow()
}

/**
 * Send to the renderer, creating a window if none is open (macOS keeps the
 * app alive with no windows) and queueing until the renderer is listening.
 */
function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (!app.isReady()) {
    pendingMessages.push({ channel, args })
    return
  }
  const win = getOrCreateWindow()
  if (rendererReady) {
    win.webContents.send(channel, ...args)
  } else {
    pendingMessages.push({ channel, args })
  }
}

function flushPendingMessages(): void {
  const win = getLiveWindow()
  if (!win || !rendererReady) return
  for (const { channel, args } of pendingMessages.splice(0)) {
    win.webContents.send(channel, ...args)
  }
}

function openFilePath(filePath: string): void {
  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch (e) {
    console.error('Failed to open file', e)
    if (app.isReady()) {
      dialog.showErrorBox('Could not open file', `${filePath}\n\n${(e as Error).message}`)
    }
    return
  }
  sendToRenderer('file:opened', { path: filePath, content })
  if (app.isReady()) addRecentFile(filePath)
}

/** Ask the renderer whether it's OK to close (it may prompt about unsaved changes). */
function askRendererToClose(win: BrowserWindow): void {
  if (awaitingRendererAnswer) return
  awaitingRendererAnswer = true
  win.webContents.send('app:before-close')
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
  })

  // A committed page load (initial, or a reload) drops the renderer's
  // listeners until it announces itself again via renderer:ready. Use
  // did-navigate, not did-start-navigation: the latter also fires for
  // navigations that will-navigate then cancels.
  win.webContents.on('did-navigate', () => {
    rendererReady = false
  })

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
      rendererReady = false
      awaitingRendererAnswer = false
      pendingQuit = false
    }
  })

  // Log renderer console messages to main process stdout for debugging
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    // Electron levels: 0 = verbose, 1 = info, 2 = warning, 3 = error
    const levelStr = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'][level] ?? 'INFO'
    console.log(`[Renderer ${levelStr}] ${message} (${sourceId}:${line})`)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    openUrlSafely(url)
    return { action: 'deny' }
  })

  // Never let the app page be replaced — e.g. by a file dropped on the
  // window or a link clicked inside rendered content. Route the target
  // instead (markdown files open as tabs, web links go to the browser).
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return
    event.preventDefault()
    openUrlSafely(url)
  })

  // If the renderer died, the confirm-close handshake can never complete —
  // destroy the window so it doesn't become unclosable.
  win.webContents.on('render-process-gone', () => {
    if (!win.isDestroyed()) win.destroy()
  })

  win.on('close', (e) => {
    // Quit already approved by the renderer (or nothing to ask)
    if (quitConfirmed) return
    // Renderer not listening yet (still loading): nothing unsaved to lose
    if (!rendererReady) return
    // Renderer handles the unsaved-changes prompt and answers via IPC
    e.preventDefault()
    askRendererToClose(win)
  })

  // The dev Electron binary is renamed to Markora, so app.isPackaged is true
  // and is.dev is false. The dev server URL is the reliable signal.
  if (process.env['ELECTRON_RENDERER_URL']) {
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

function buildMenu(): void {
  const recentFiles = loadRecentFiles()
  const isMac = process.platform === 'darwin'
  // Menu items outlive windows on macOS, so never capture a window here —
  // resolve (or create) the live one when the item is clicked.
  const send = (action: string) => sendToRenderer('menu:action', action)

  const recentItems: MenuItemConstructorOptions[] =
    recentFiles.length > 0
      ? [
          ...recentFiles.map((f) => ({
            label: baseName(f),
            click: () => openFilePath(f)
          })),
          { type: 'separator' as const },
          {
            label: 'Clear Recent',
            click: () => {
              saveRecentFiles([])
              app.clearRecentDocuments()
              buildMenu()
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
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => send('tab:new')
        },
        {
          label: 'Open File…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(getOrCreateWindow(), {
              properties: ['openFile'],
              filters: [
                { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            })
            if (!result.canceled && result.filePaths[0]) {
              openFilePath(result.filePaths[0])
            }
          }
        },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(getOrCreateWindow(), {
              properties: ['openDirectory']
            })
            if (!result.canceled && result.filePaths[0]) {
              sendToRenderer('folder:opened', { path: result.filePaths[0] })
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
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => send('tab:close')
        },
        isMac
          ? { label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W', role: 'close' as const }
          : { role: 'quit' as const }
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
          // Cmd+H is Hide on macOS
          accelerator: isMac ? 'Cmd+Alt+F' : 'Ctrl+H',
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
          label: 'Next Tab',
          accelerator: 'Control+Tab',
          click: () => send('tab:next')
        },
        {
          label: 'Previous Tab',
          accelerator: 'Control+Shift+Tab',
          click: () => send('tab:prev')
        },
        {
          id: 'focus-mode',
          label: 'Focus Mode',
          accelerator: 'F8',
          type: 'checkbox',
          checked: menuState.focus,
          click: (item) => {
            menuState.focus = item.checked
            send(item.checked ? 'mode:focus:on' : 'mode:focus:off')
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
            send(item.checked ? 'mode:typewriter:on' : 'mode:typewriter:off')
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
            { label: 'GitHub', click: () => sendToRenderer('theme:set', 'github') },
            { label: 'Academic', click: () => sendToRenderer('theme:set', 'academic') },
            { label: 'Night', click: () => sendToRenderer('theme:set', 'night') },
            { label: 'Newsprint', click: () => sendToRenderer('theme:set', 'newsprint') },
            { label: 'Gothic', click: () => sendToRenderer('theme:set', 'gothic') },
            { label: 'Whitey', click: () => sendToRenderer('theme:set', 'whitey') }
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
        { label: 'Bullet List', accelerator: 'CmdOrCtrl+Shift+8', click: () => send('list:bullet') },
        { label: 'Ordered List', accelerator: 'CmdOrCtrl+Shift+7', click: () => send('list:ordered') },
        { label: 'Task List', accelerator: 'CmdOrCtrl+Shift+9', click: () => send('list:task') },
        { label: 'Block Quote', accelerator: 'CmdOrCtrl+Shift+Q', click: () => send('format:blockquote') },
        { label: 'Horizontal Rule', accelerator: 'CmdOrCtrl+Alt+-', click: () => send('insert:hr') },
        { label: 'Clear Formatting', click: () => send('format:clear') }
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
          click: () => shell.openExternal('https://github.com/amitmaity/markora')
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
  ipcMain.handle('dialog:openFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
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
  ipcMain.handle('dialog:saveFile', async (e, defaultName: string, content: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
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
  ipcMain.handle('dialog:openFolder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
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

  ipcMain.handle('dialog:openImage', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
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
  ipcMain.handle('dialog:saveHtml', async (e, content: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'HTML', extensions: ['html'] }]
    })
    if (result.canceled || !result.filePath) return null
    writeFileSync(result.filePath, content, 'utf-8')
    return result.filePath
  })

  // Export PDF (isolated off-screen window for pure document rendering)
  ipcMain.handle('export:pdf', async (e, payload: { outputPath: string; html?: string; title?: string } | string) => {
    const outputPath = typeof payload === 'string' ? payload : payload.outputPath
    const htmlContent = typeof payload === 'string' ? null : payload.html

    if (!outputPath) return null

    if (htmlContent) {
      // Create hidden off-screen window for clean rendering. Write the HTML
      // to a temp file — data: URLs hit Chromium size limits on large docs.
      const tmpHtmlPath = join(app.getPath('temp'), `markora-export-${Date.now()}.html`)
      writeFileSync(tmpHtmlPath, await inlineFontUrls(htmlContent), 'utf-8')
      const printWin = new BrowserWindow({
        show: false,
        width: 850,
        height: 1100,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          // Static document — nothing in it needs to run
          javascript: false
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
    } else {
      // Fallback: print the requesting window
      const pdfData = await e.sender.printToPDF({
        printBackground: true,
        margins: { marginType: 'custom', top: 1, bottom: 1, left: 1, right: 1 }
      })
      writeFileSync(outputPath, pdfData)
      return outputPath
    }
  })

  // Save PDF dialog
  ipcMain.handle('dialog:savePdf', async (e, defaultName: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
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

  // Renderer has registered its listeners — deliver anything queued
  ipcMain.on('renderer:ready', (e) => {
    const win = getLiveWindow()
    if (!win || e.sender !== win.webContents) return
    rendererReady = true
    flushPendingMessages()
  })

  // Renderer says it's OK to close (no unsaved changes, or user discarded)
  ipcMain.on('app:confirm-close', () => {
    awaitingRendererAnswer = false
    if (pendingQuit) {
      pendingQuit = false
      quitConfirmed = true
      app.quit()
      return
    }
    getLiveWindow()?.destroy()
  })

  // Renderer declined to close (user kept their changes) — the close or
  // quit was already prevented; just reset the handshake.
  ipcMain.on('app:cancel-close', () => {
    awaitingRendererAnswer = false
    pendingQuit = false
  })

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
  ipcMain.on('window:setTitle', (e, title: string) => {
    BrowserWindow.fromWebContents(e.sender)?.setTitle(title)
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
  let names: string[]
  try {
    names = readdirSync(dirPath)
  } catch {
    return []
  }
  const entries: FileEntry[] = []
  for (const name of names) {
    if (name.startsWith('.') || IGNORED_DIRS.has(name)) continue
    const fullPath = join(dirPath, name)
    // One unreadable entry (broken symlink, no permission) must not hide
    // the rest of the folder — skip just that entry.
    let isDirectory: boolean
    try {
      isDirectory = statSync(fullPath).isDirectory()
    } catch {
      continue
    }
    if (isDirectory) {
      entries.push({
        name,
        path: fullPath,
        type: 'directory',
        children: readDirRecursive(fullPath, rootPath, depth + 1)
      })
    } else {
      const ext = name.includes('.') ? name.split('.').pop() ?? '' : ''
      entries.push({ name, path: fullPath, type: 'file', extension: ext })
    }
  }
  return entries.sort((a, b) => {
    // Directories first, then files
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

// ---------------------------------------------------------------------------
// PDF export helper
// ---------------------------------------------------------------------------
/**
 * The renderer inlines the app's KaTeX stylesheet into PDF exports with
 * absolute font URLs (dev server or the packaged app's assets). The print
 * window loads the export from a temp file, which can't reliably load fonts
 * from those origins, so embed each woff2 font as a data URL. Everything stays
 * local, so math renders the same offline.
 */
async function inlineFontUrls(html: string): Promise<string> {
  // Only the app's own font locations: packaged assets (file:) or the local
  // dev server. Never fetch arbitrary hosts named in document content.
  const pattern =
    /url\((["']?)((?:file:\/\/|https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/)[^"')]+\.woff2)\1\)/g
  const urls = new Set<string>()
  for (const match of html.matchAll(pattern)) urls.add(match[2])
  if (urls.size === 0) return html

  const dataUrls = new Map<string, string>()
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const res = await net.fetch(url)
        if (!res.ok) return
        const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
        dataUrls.set(url, `data:font/woff2;base64,${base64}`)
      } catch {
        /* leave the original URL; the font just won't load */
      }
    })
  )
  return html.replace(pattern, (whole, _quote: string, url: string) => {
    const dataUrl = dataUrls.get(url)
    return dataUrl ? `url("${dataUrl}")` : whole
  })
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
      applicationVersion: app.getVersion(),
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

  // Handlers first so the new window's renderer:ready is never missed
  registerIpcHandlers()
  createWindow()
  buildMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  if (quitConfirmed) return
  const win = getLiveWindow()
  // No window, or its renderer isn't listening yet: nothing unsaved to ask about
  if (!win || !rendererReady) {
    quitConfirmed = true
    return
  }
  // Hold the quit until the renderer has checked for unsaved changes; it
  // answers with app:confirm-close (quit) or app:cancel-close (stay).
  event.preventDefault()
  pendingQuit = true
  askRendererToClose(win)
})

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  // On macOS this can fire before the app is ready (launch-with-file);
  // openFilePath queues it until the renderer is listening.
  openFilePath(filePath)
})
