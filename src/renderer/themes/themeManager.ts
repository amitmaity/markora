import type { ThemeName } from '../types/editor'

const THEME_KEY = 'markora:theme'

export function getStoredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(THEME_KEY) || localStorage.getItem('typora-clone:theme')
    if (stored && ALL_THEMES.includes(stored as ThemeName)) {
      return stored as ThemeName
    }
  } catch {
    // ignore
  }
  return 'github'
}

export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme === 'night' ? 'dark' : 'light'

  if (theme === 'night') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  if (document.body) {
    document.body.setAttribute('data-theme', theme)
  }

  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
}

export const THEME_LABELS: Record<ThemeName, string> = {
  github: 'GitHub',
  academic: 'Academic',
  night: 'Night',
  newsprint: 'Newsprint',
  gothic: 'Gothic',
  whitey: 'Whitey'
}

export const ALL_THEMES: ThemeName[] = ['github', 'academic', 'night', 'newsprint', 'gothic', 'whitey']
