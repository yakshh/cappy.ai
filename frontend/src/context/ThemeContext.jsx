import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem('vault-theme')
    if (s) return s === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('vault-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  return (
    <ThemeContext.Provider value={{ isDark, setIsDark, toggle: () => setIsDark(p => !p) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Fallback default if used outside ThemeProvider
    return { isDark: true, toggle: () => {} }
  }
  return ctx
}
