import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export const COLOR_THEMES = [
  { id: 'rusty-red', name: 'Rusty Red', description: 'Warm brick-red, the original cappy.ai look', accent: '#C9514A', accentHi: '#D96560' },
  { id: 'blastic-blue', name: 'Blastic Blue', description: 'Focused blue with a cool midnight canvas', accent: '#4B8DF8', accentHi: '#75ADFF' },
  { id: 'planatic-pink', name: 'Planatic Pink', description: 'Confident pink with a soft berry glow', accent: '#E66AA6', accentHi: '#F28CC0' },
  { id: 'gardenic-green', name: 'Gardenic Green', description: 'Calm green inspired by a quiet study garden', accent: '#4CAF78', accentHi: '#72D39A' },
  { id: 'prismatic-purple', name: 'Prismatic Purple', description: 'Creative violet with a polished evening glow', accent: '#9B7AF5', accentHi: '#B69BFF' },
  { id: 'orbitic-orange', name: 'Orbitic Orange', description: 'Energetic amber for bright study sessions', accent: '#E8893A', accentHi: '#FFAD62' },
  { id: 'graphitic-grey', name: 'Graphitic Grey', description: 'Minimal graphite with a precise neutral finish', accent: '#8A96A8', accentHi: '#AEB8C7' },
  { id: 'brewic-brown', name: 'Brewic Brown', description: 'Grounded coffee tones for a cozy workspace', accent: '#B8794F', accentHi: '#D49A6E' },
]

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem('vault-theme')
    if (s) return s === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [colorTheme, setColorTheme] = useState(() => localStorage.getItem('vault-color-theme') || 'rusty-red')

  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-theme', isDark ? 'dark' : 'light')
    el.setAttribute('data-color-theme', colorTheme)
    localStorage.setItem('vault-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('vault-color-theme', colorTheme)
  }, [isDark, colorTheme])

  return (
    <ThemeContext.Provider value={{ isDark, setIsDark, colorTheme, setColorTheme, colorThemes: COLOR_THEMES, toggle: () => setIsDark(p => !p) }}>
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
