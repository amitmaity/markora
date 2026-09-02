import React, { useEffect, useState, useRef } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { PanelLeft, Palette, Code, AlignCenter, Check, ChevronDown, CodeXml } from 'lucide-react'
import { THEME_LABELS, ALL_THEMES } from '../../themes/themeManager'
import appIcon from '../../assets/icon.png'

export default function TitleBar() {
  const {
    fileName,
    isDirty,
    isSourceMode,
    isFocusMode,
    isTypewriterMode,
    toggleSidebar,
    toggleSourceMode,
    toggleFocusMode,
    toggleTypewriterMode,
    activeTheme,
    setTheme,
    openSnippetModal
  } = useEditorStore()

  const [platform, setPlatform] = useState<string>('darwin')
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getPlatform().then(setPlatform)
    }
  }, [])

  // Close theme menu when clicking outside
  useEffect(() => {
    if (!showThemeMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showThemeMenu])

  const isMac = platform === 'darwin'
  const title = `${isDirty ? '● ' : ''}${fileName} — Markora`

  return (
    <div
      className={`flex items-center h-10 flex-shrink-0 titlebar-drag select-none ${
        isMac ? 'pl-20' : 'pl-3'
      }`}
      style={{
        background: 'var(--chrome-bg)',
        borderBottom: '1px solid var(--chrome-border)',
        color: 'var(--chrome-text)'
      }}
    >
      {/* Non-Mac: App icon on left */}
      {!isMac && (
        <div className="flex items-center pl-1 pr-2 gap-1.5 titlebar-no-drag">
          <img src={appIcon} alt="Markora" className="w-4 h-4 rounded-sm shadow-sm" />
          <span className="text-xs font-semibold opacity-80">Markora</span>
        </div>
      )}

      {/* Document title & App Name — centered */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-4 gap-2">
        <img src={appIcon} alt="" className="w-4 h-4 rounded-sm shadow-sm pointer-events-none" />
        <span className="text-sm font-semibold opacity-90 truncate max-w-sm titlebar-no-drag" title={title}>
          {isDirty ? '● ' : ''}{fileName}
        </span>
        <span className="text-xs font-normal opacity-40 select-none titlebar-no-drag">
          — Markora
        </span>
      </div>

      {/* Mode toggles & Theme picker */}
      <div className="flex items-center gap-1 mr-2 titlebar-no-drag">
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-1.5 rounded hover:bg-black/10 transition-colors cursor-pointer"
          title="Toggle Sidebar (⌘`)"
        >
          <PanelLeft size={14} style={{ color: 'var(--chrome-text)' }} />
        </button>
        <button
          type="button"
          onClick={toggleFocusMode}
          className={`p-1.5 rounded transition-colors cursor-pointer ${isFocusMode ? 'bg-black/15' : 'hover:bg-black/10'}`}
          title="Focus Mode (F8)"
        >
          <AlignCenter size={14} style={{ color: 'var(--chrome-text)' }} />
        </button>
        <button
          type="button"
          onClick={toggleTypewriterMode}
          className={`p-1.5 rounded transition-colors cursor-pointer ${isTypewriterMode ? 'bg-black/15' : 'hover:bg-black/10'}`}
          title="Typewriter Mode (F9)"
        >
          <AlignCenter size={14} style={{ color: 'var(--chrome-text)', transform: 'rotate(90deg)' }} />
        </button>
        <button
          type="button"
          onClick={toggleSourceMode}
          className={`p-1.5 rounded transition-colors cursor-pointer ${isSourceMode ? 'bg-black/15' : 'hover:bg-black/10'}`}
          title="Source Code Mode (⌘/)"
        >
          <Code size={14} style={{ color: 'var(--chrome-text)' }} />
        </button>
        <button
          type="button"
          onClick={openSnippetModal}
          className="p-1.5 rounded hover:bg-black/10 transition-colors cursor-pointer"
          title="Insert Code Snippet (⌘⌥C)"
        >
          <CodeXml size={14} style={{ color: 'var(--chrome-text)' }} />
        </button>

        {/* Theme picker */}
        <div className="relative" ref={themeMenuRef}>
          <button
            type="button"
            onClick={() => setShowThemeMenu((v) => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-xs font-medium cursor-pointer ${
              showThemeMenu ? 'bg-black/15' : 'hover:bg-black/10'
            }`}
            title={`Current Theme: ${THEME_LABELS[activeTheme]}`}
            style={{ color: 'var(--chrome-text)' }}
          >
            <Palette size={13} />
            <span className="hidden sm:inline">{THEME_LABELS[activeTheme]}</span>
            <ChevronDown size={11} className="opacity-60" />
          </button>

          {showThemeMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl z-50 py-1.5 border overflow-hidden titlebar-no-drag"
              style={{
                background: 'var(--chrome-bg)',
                borderColor: 'var(--chrome-border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
              }}
            >
              <div
                className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold opacity-50"
                style={{ color: 'var(--chrome-text)' }}
              >
                Themes
              </div>
              {ALL_THEMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTheme(t)
                    setShowThemeMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-black/10 flex items-center justify-between transition-colors cursor-pointer"
                  style={{
                    color: 'var(--chrome-text)',
                    fontWeight: activeTheme === t ? 600 : 400,
                    background: activeTheme === t ? 'var(--sidebar-active)' : 'transparent'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/20 flex-shrink-0"
                      style={{
                        background:
                          t === 'github' ? '#ffffff' :
                          t === 'night' ? '#0d1117' :
                          t === 'academic' ? '#faf8f2' :
                          t === 'newsprint' ? '#f7f4ed' :
                          t === 'gothic' ? '#ffffff' : '#fefefe'
                      }}
                    />
                    <span>{THEME_LABELS[t]}</span>
                  </div>
                  {activeTheme === t && (
                    <Check size={12} style={{ color: 'var(--sidebar-active-text, #0969da)' }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Window controls: on Windows/Linux the window uses the native frame
          (frame: true in main), so the native title bar handles min/max/close.
          On macOS the native traffic lights are used (hiddenInset). */}
    </div>
  )
}
