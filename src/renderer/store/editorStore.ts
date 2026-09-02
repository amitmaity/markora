import { create } from 'zustand'
import type { ThemeName, FileEntry, DocumentStats, HeadingItem } from '../types/editor'
import { applyTheme } from '../themes/themeManager'

interface EditorState {
  // Document
  filePath: string | null
  fileName: string
  rawMarkdown: string
  savedMarkdown: string
  isDirty: boolean

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

  // Stats
  stats: DocumentStats

  // Outline
  headings: HeadingItem[]

  // Find/Replace
  isFindOpen: boolean
  isReplaceOpen: boolean

  // Code Snippet Modal
  isSnippetModalOpen: boolean

  // Recent files
  recentFiles: string[]

  // Actions
  setDocument: (path: string | null, content: string) => void
  updateMarkdown: (md: string) => void
  markSaved: () => void
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
  updateStats: (stats: DocumentStats) => void
  setHeadings: (headings: HeadingItem[]) => void
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

export const useEditorStore = create<EditorState>((set) => ({
  // Document
  filePath: null,
  fileName: 'Untitled',
  rawMarkdown: '',
  savedMarkdown: '',
  isDirty: false,

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

  // Stats
  stats: { wordCount: 0, charCount: 0, lineCount: 0, readingTime: 0 },

  // Outline
  headings: [],

  // Find
  isFindOpen: false,
  isReplaceOpen: false,

  // Snippet modal
  isSnippetModalOpen: false,

  // Recent
  recentFiles: [],

  // Actions
  setDocument: (path, content) =>
    set({
      filePath: path,
      fileName: path ? path.split(/[\\/]/).pop() ?? 'Untitled' : 'Untitled',
      rawMarkdown: content,
      savedMarkdown: content,
      isDirty: false,
      stats: calcStats(content)
    }),

  updateMarkdown: (md) =>
    set((state) => ({
      rawMarkdown: md,
      isDirty: md !== state.savedMarkdown,
      stats: calcStats(md)
    })),

  markSaved: () => set((state) => ({ isDirty: false, savedMarkdown: state.rawMarkdown })),

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

  updateStats: (stats) => set({ stats }),

  setHeadings: (headings) => set({ headings }),

  openFind: (withReplace = false) => set({ isFindOpen: true, isReplaceOpen: withReplace }),

  closeFind: () => set({ isFindOpen: false, isReplaceOpen: false }),

  openSnippetModal: () => set({ isSnippetModalOpen: true }),

  closeSnippetModal: () => set({ isSnippetModalOpen: false }),

  setRecentFiles: (files) => set({ recentFiles: files })
}))
