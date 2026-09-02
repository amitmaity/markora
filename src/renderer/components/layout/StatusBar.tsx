import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { Palette } from 'lucide-react'
import { ALL_THEMES, THEME_LABELS } from '../../themes/themeManager'

export default function StatusBar() {
  const { stats, isSourceMode, isFocusMode, isTypewriterMode, filePath, activeTheme, setTheme } = useEditorStore()
  const { wordCount, charCount, lineCount, readingTime } = stats

  const cycleTheme = () => {
    const nextIdx = (ALL_THEMES.indexOf(activeTheme) + 1) % ALL_THEMES.length
    setTheme(ALL_THEMES[nextIdx])
  }

  return (
    <div
      className="flex items-center justify-between px-4 h-6 flex-shrink-0 text-xs select-none"
      style={{
        background: 'var(--chrome-bg)',
        borderTop: '1px solid var(--chrome-border)',
        color: 'var(--chrome-text)',
        opacity: 0.8
      }}
    >
      {/* Left: stats */}
      <div className="flex items-center gap-4">
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
        <span>{lineCount} lines</span>
        <span>~{readingTime} min read</span>
      </div>

      {/* Right: modes + theme + path */}
      <div className="flex items-center gap-2.5">
        {isFocusMode && (
          <span className="px-1.5 py-0.5 rounded text-[11px]" style={{ background: 'rgba(0,0,0,0.1)' }}>
            Focus
          </span>
        )}
        {isTypewriterMode && (
          <span className="px-1.5 py-0.5 rounded text-[11px]" style={{ background: 'rgba(0,0,0,0.1)' }}>
            Typewriter
          </span>
        )}
        {isSourceMode && (
          <span className="px-1.5 py-0.5 rounded text-[11px]" style={{ background: 'rgba(0,0,0,0.1)' }}>
            Source
          </span>
        )}

        {/* Clickable theme cycler in status bar */}
        <button
          type="button"
          onClick={cycleTheme}
          className="px-1.5 py-0.5 rounded text-[11px] hover:bg-black/10 transition-colors cursor-pointer flex items-center gap-1"
          title={`Click to switch theme (current: ${THEME_LABELS[activeTheme]})`}
          style={{ color: 'var(--chrome-text)' }}
        >
          <Palette size={11} />
          <span>{THEME_LABELS[activeTheme]}</span>
        </button>

        {filePath && (
          <span className="opacity-50 truncate max-w-48 text-[11px]" title={filePath}>
            {filePath.split('/').slice(-2).join('/')}
          </span>
        )}
      </div>
    </div>
  )
}
