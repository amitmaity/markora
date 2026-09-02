export type ThemeName = 'github' | 'academic' | 'night' | 'newsprint' | 'gothic' | 'whitey'

export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileEntry[]
  extension?: string
}

export interface DocumentStats {
  wordCount: number
  charCount: number
  lineCount: number
  readingTime: number // in minutes
}

export interface HeadingItem {
  level: number
  text: string
  id: string
  pos: number
}

export interface SearchMatch {
  path: string
  name: string
}
