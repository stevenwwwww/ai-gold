/**
 * 全局状态管理
 * 使用 Zustand，可选接入
 */
import { create } from 'zustand'

export interface AppState {
  selectedModel: string
  setSelectedModel: (model: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedModel: 'deepseek',
  setSelectedModel: (model) => set({ selectedModel: model })
}))
