import { create } from 'zustand'
import type { ThemeName, FileEntry, DocumentStats, HeadingItem, Tab } from '../types/editor'
import { applyTheme } from '../themes/themeManager'

export const WELCOME_MARKDOWN = `# Welcome to Markora

Start writing in **Markdown**. All standard formatting is supported.

- Open a file with **File → Open** or **⌘O**
- Create a new document with **⌘N**
- Save with **⌘S**
- Insert Code Snippet with **⌘⌥C**

> Toggle **Source Code Mode** with ⌘/ to edit raw Markdown.
`

const EMPTY_STATS: DocumentStats = { wordCount: 0, charCount: 0, lineCount: 0, readingTime: 0 }

interface EditorState {
  tabs: Tab[]
  activeTabId: string

  // Workspace
  workspacePath: string | null
  fileTree: FileEntry[]

  // UI Modes
  isSourceMode: boolean
  isFocusMode: boolean
  isTypewriterMode: boolean
  isSidebarVisible: boolean
  sidebarTab: 'files' | 'outline' | 'search'

  // Theme
  activeTheme: ThemeName

  // Find/Replace
  isFindOpen: boolean
  isReplaceOpen: boolean

  // Code Snippet Modal
  isSnippetModalOpen: boolean

  // Recent files
  recentFiles: string[]

  // Tab actions
  openTab: (path: string, content: string) => void
  newTab: () => void
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  closeAllTabs: () => void
  activateTab: (id: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  nextTab: () => void
  prevTab: () => void
  updateTabMarkdown: (id: string, md: string) => void
  markTabSaved: (id: string) => void
  setTabDocument: (id: string, path: string | null, content: string) => void
  setTabHeadings: (id: string, headings: HeadingItem[]) => void
  reconcileTabMarkdown: (id: string, md: string) => void

  // Workspace / UI actions
  setWorkspace: (path: string, tree: FileEntry[]) => void
  setFileTree: (tree: FileEntry[]) => void
  toggleSourceMode: () => void
  toggleFocusMode: () => void
  toggleTypewriterMode: () => void
  setFocusMode: (value: boolean) => void
  setTypewriterMode: (value: boolean) => void
  toggleSidebar: () => void
  setSidebarTab: (tab: 'files' | 'outline' | 'search') => void
  setTheme: (theme: ThemeName) => void
  openFind: (withReplace?: boolean) => void
  closeFind: () => void
  openSnippetModal: () => void
  closeSnippetModal: () => void
  setRecentFiles: (files: string[]) => void
}

function calcStats(md: string): DocumentStats {
  const text = md.trim()
  const words = text ? text.split(/\s+/).length : 0
  const chars = text.length
  const lines = text ? text.split('\n').length : 0
  const readingTime = Math.max(1, Math.ceil(words / 200))
  return { wordCount: words, charCount: chars, lineCount: lines, readingTime }
}

function fileNameFromPath(path: string | null): string {
  return path ? path.split(/[\\/]/).pop() ?? 'Untitled' : 'Untitled'
}

function nextTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: nextTabId(),
    filePath: null,
    fileName: 'Untitled',
    rawMarkdown: '',
    savedMarkdown: '',
    isDirty: false,
    stats: EMPTY_STATS,
    headings: [],
    ...overrides
  }
}

function createWelcomeTab(): Tab {
  return createTab({
    rawMarkdown: WELCOME_MARKDOWN,
    savedMarkdown: WELCOME_MARKDOWN,
    stats: calcStats(WELCOME_MARKDOWN)
  })
}

function createEmptyTab(): Tab {
  return createTab()
}

function isReusableUntitled(tab: Tab): boolean {
  return tab.filePath === null && !tab.isDirty
}

function patchTab(tabs: Tab[], id: string, patch: Partial<Tab> | ((tab: Tab) => Tab)): Tab[] {
  return tabs.map((tab) => {
    if (tab.id !== id) return tab
    return typeof patch === 'function' ? patch(tab) : { ...tab, ...patch }
  })
}

const initialTab = createWelcomeTab()

export const useEditorStore = create<EditorState>((set) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  // Workspace
  workspacePath: null,
  fileTree: [],

  // UI modes
  isSourceMode: false,
  isFocusMode: false,
  isTypewriterMode: false,
  isSidebarVisible: true,
  sidebarTab: 'files',

  // Theme
  activeTheme: 'github',

  // Find
  isFindOpen: false,
  isReplaceOpen: false,

  // Snippet modal
  isSnippetModalOpen: false,

  // Recent
  recentFiles: [],

  openTab: (path, content) =>
    set((state) => {
      const existing = state.tabs.find((tab) => tab.filePath === path)
      if (existing) return { activeTabId: existing.id }

      const doc: Partial<Tab> = {
        filePath: path,
        fileName: fileNameFromPath(path),
        rawMarkdown: content,
        savedMarkdown: content,
        isDirty: false,
        stats: calcStats(content),
        headings: []
      }

      const active = state.tabs.find((tab) => tab.id === state.activeTabId)
      if (active && isReusableUntitled(active)) {
        return { tabs: patchTab(state.tabs, active.id, doc) }
      }

      const tab = createTab(doc)
      return { tabs: [...state.tabs, tab], activeTabId: tab.id }
    }),

  newTab: () =>
    set((state) => {
      const tab = createEmptyTab()
      return { tabs: [...state.tabs, tab], activeTabId: tab.id }
    }),

  closeTab: (id) =>
    set((state) => {
      const idx = state.tabs.findIndex((tab) => tab.id === id)
      if (idx === -1) return state

      if (state.tabs.length === 1) {
        const fresh = createEmptyTab()
        return { tabs: [fresh], activeTabId: fresh.id }
      }

      const tabs = state.tabs.filter((tab) => tab.id !== id)
      let { activeTabId } = state
      if (activeTabId === id) {
        const nextIdx = Math.min(idx, tabs.length - 1)
        activeTabId = tabs[nextIdx].id
      }
      return { tabs, activeTabId }
    }),

  closeOtherTabs: (id) =>
    set((state) => {
      const keep = state.tabs.find((tab) => tab.id === id)
      if (!keep) return state
      return { tabs: [keep], activeTabId: keep.id }
    }),

  closeAllTabs: () =>
    set(() => {
      const fresh = createEmptyTab()
      return { tabs: [fresh], activeTabId: fresh.id }
    }),

  activateTab: (id) =>
    set((state) => (state.tabs.some((tab) => tab.id === id) ? { activeTabId: id } : state)),

  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.tabs.length ||
        toIndex >= state.tabs.length
      ) {
        return state
      }
      const tabs = [...state.tabs]
      const [moved] = tabs.splice(fromIndex, 1)
      tabs.splice(toIndex, 0, moved)
      return { tabs }
    }),

  nextTab: () =>
    set((state) => {
      if (state.tabs.length < 2) return state
      const idx = state.tabs.findIndex((tab) => tab.id === state.activeTabId)
      const next = state.tabs[(idx + 1) % state.tabs.length]
      return { activeTabId: next.id }
    }),

  prevTab: () =>
    set((state) => {
      if (state.tabs.length < 2) return state
      const idx = state.tabs.findIndex((tab) => tab.id === state.activeTabId)
      const prev = state.tabs[(idx - 1 + state.tabs.length) % state.tabs.length]
      return { activeTabId: prev.id }
    }),

  updateTabMarkdown: (id, md) =>
    set((state) => ({
      tabs: patchTab(state.tabs, id, (tab) => ({
        ...tab,
        rawMarkdown: md,
        isDirty: md !== tab.savedMarkdown,
        stats: calcStats(md)
      }))
    })),

  markTabSaved: (id) =>
    set((state) => ({
      tabs: patchTab(state.tabs, id, (tab) => ({
        ...tab,
        isDirty: false,
        savedMarkdown: tab.rawMarkdown
      }))
    })),

  setTabDocument: (id, path, content) =>
    set((state) => ({
      tabs: patchTab(state.tabs, id, {
        filePath: path,
        fileName: fileNameFromPath(path),
        rawMarkdown: content,
        savedMarkdown: content,
        isDirty: false,
        stats: calcStats(content)
      })
    })),

  setTabHeadings: (id, headings) =>
    set((state) => ({
      tabs: patchTab(state.tabs, id, { headings })
    })),

  reconcileTabMarkdown: (id, md) =>
    set((state) => ({
      tabs: patchTab(state.tabs, id, (tab) => {
        if (tab.isDirty || tab.rawMarkdown === md) return tab
        return {
          ...tab,
          rawMarkdown: md,
          savedMarkdown: md,
          stats: calcStats(md)
        }
      })
    })),

  setWorkspace: (path, tree) => set({ workspacePath: path, fileTree: tree }),

  setFileTree: (tree) => set({ fileTree: tree }),

  toggleSourceMode: () => set((s) => ({ isSourceMode: !s.isSourceMode })),

  toggleFocusMode: () => set((s) => ({ isFocusMode: !s.isFocusMode })),

  toggleTypewriterMode: () => set((s) => ({ isTypewriterMode: !s.isTypewriterMode })),

  setFocusMode: (value) => set({ isFocusMode: value }),

  setTypewriterMode: (value) => set({ isTypewriterMode: value }),

  toggleSidebar: () => set((s) => ({ isSidebarVisible: !s.isSidebarVisible })),

  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  setTheme: (theme) => {
    applyTheme(theme)
    set({ activeTheme: theme })
  },

  openFind: (withReplace = false) => set({ isFindOpen: true, isReplaceOpen: withReplace }),

  closeFind: () => set({ isFindOpen: false, isReplaceOpen: false }),

  openSnippetModal: () => set({ isSnippetModalOpen: true }),

  closeSnippetModal: () => set({ isSnippetModalOpen: false }),

  setRecentFiles: (files) => set({ recentFiles: files })
}))

export function getActiveTab(): Tab {
  const state = useEditorStore.getState()
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0]
}

export function useActiveTab(): Tab {
  return useEditorStore((s) => s.tabs.find((tab) => tab.id === s.activeTabId) ?? s.tabs[0])
}

export function hasUnsavedTabs(): boolean {
  return useEditorStore.getState().tabs.some((tab) => tab.isDirty)
}
