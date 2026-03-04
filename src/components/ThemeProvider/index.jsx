import React, { useState, useEffect, createContext, useContext } from 'react'
import Taro from '@tarojs/taro'
import { themeService } from '@/services/theme/ThemeService'

const ThemeContext = createContext({ isDark: false, toggle: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export function useThemeClass() {
  const { isDark } = useTheme()
  return isDark ? 'theme-dark' : 'theme-light'
}

/**
 * Hook for pages to apply page-level style on mount / theme change.
 * Call this in each page component to sync page bg & nav bar.
 */
export function usePageTheme() {
  const { isDark } = useTheme()

  useEffect(() => {
    try {
      const bg = isDark ? '#0D1017' : '#F5F6FA'
      const navBg = isDark ? '#161B26' : '#FFFFFF'
      Taro.setBackgroundColor({
        backgroundColor: bg,
        backgroundColorTop: bg,
        backgroundColorBottom: bg,
      })
      Taro.setNavigationBarColor({
        frontColor: isDark ? '#ffffff' : '#000000',
        backgroundColor: navBg,
        animation: { duration: 200, timingFunc: 'easeIn' },
      })
    } catch (e) {
      console.warn('[usePageTheme]', e)
    }
  }, [isDark])

  return isDark ? 'theme-dark' : 'theme-light'
}

export default function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(themeService.current.id)

  useEffect(() => {
    const unsub = themeService.onChange((t) => {
      setThemeId(t.id)
    })
    return unsub
  }, [])

  const isDark = themeId === 'dark'

  return (
    <ThemeContext.Provider value={{ isDark, toggle: () => themeService.toggle() }}>
      {children}
    </ThemeContext.Provider>
  )
}
