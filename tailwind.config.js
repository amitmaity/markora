/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,html}'],
  darkMode: ['class', '[data-theme="night"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['Georgia', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', 'monospace']
      },
      colors: {
        sidebar: {
          bg: 'var(--sidebar-bg)',
          text: 'var(--sidebar-text)',
          border: 'var(--sidebar-border)',
          hover: 'var(--sidebar-hover)',
          active: 'var(--sidebar-active)'
        },
        editor: {
          bg: 'var(--editor-bg)',
          text: 'var(--editor-text)'
        },
        chrome: {
          bg: 'var(--chrome-bg)',
          border: 'var(--chrome-border)',
          text: 'var(--chrome-text)'
        }
      }
    }
  },
  plugins: []
}
