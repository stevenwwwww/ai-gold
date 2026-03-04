/**
 * 主题服务 - 明亮/暗黑主题切换
 * 预留多主题扩展能力
 */
import Taro from '@tarojs/taro'
import { getStorage, setStorage } from '@/utils/platform'

export interface ThemeConfig {
  id: string
  name: string
  bgColor: string
  textColor: string
}

const LIGHT_THEME: ThemeConfig = {
  id: 'light',
  name: '明亮',
  bgColor: '#F5F6FA',
  textColor: '#1A1D26',
}

const DARK_THEME: ThemeConfig = {
  id: 'dark',
  name: '暗黑',
  bgColor: '#0D1017',
  textColor: '#E8EAED',
}

const THEMES: Record<string, ThemeConfig> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
}

const STORAGE_KEY = 'app_theme'

class ThemeService {
  private _current: ThemeConfig
  private _listeners: Array<(theme: ThemeConfig) => void> = []

  constructor() {
    const saved = getStorage<string>(STORAGE_KEY)
    this._current = THEMES[saved || 'light'] || LIGHT_THEME
  }

  get current(): ThemeConfig {
    return this._current
  }

  get isDark(): boolean {
    return this._current.id === 'dark'
  }

  switch(themeId: string): void {
    const theme = THEMES[themeId]
    if (!theme) return
    this._current = theme
    setStorage(STORAGE_KEY, themeId)
    this._applyPageStyle(theme)
    this._listeners.forEach((fn) => fn(theme))
  }

  toggle(): void {
    this.switch(this.isDark ? 'light' : 'dark')
  }

  getAvailableThemes(): ThemeConfig[] {
    return Object.values(THEMES)
  }

  onChange(fn: (theme: ThemeConfig) => void): () => void {
    this._listeners.push(fn)
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn)
    }
  }

  private _applyPageStyle(theme: ThemeConfig): void {
    try {
      Taro.setBackgroundColor({
        backgroundColor: theme.bgColor,
        backgroundColorTop: theme.bgColor,
        backgroundColorBottom: theme.bgColor,
      })
      Taro.setNavigationBarColor({
        frontColor: theme.id === 'dark' ? '#ffffff' : '#000000',
        backgroundColor: theme.id === 'dark' ? '#161B26' : '#FFFFFF',
        animation: { duration: 200, timingFunc: 'easeIn' },
      })
    } catch (e) {
      console.warn('[ThemeService] applyPageStyle:', e)
    }
  }

  static registerTheme(config: ThemeConfig): void {
    THEMES[config.id] = config
  }
}

export const themeService = new ThemeService()
