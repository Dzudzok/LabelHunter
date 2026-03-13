import { create } from 'zustand'

function getInitialTheme() {
  try {
    return localStorage.getItem('labelhunter-theme') || 'dark'
  } catch {
    return 'dark'
  }
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

// Apply on load
const initial = getInitialTheme()
applyTheme(initial)

export const useThemeStore = create((set) => ({
  theme: initial,
  toggleTheme: () => set((state) => {
    const next = state.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('labelhunter-theme', next)
    applyTheme(next)
    return { theme: next }
  }),
}))
