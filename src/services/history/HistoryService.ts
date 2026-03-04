/**
 * 历史记录服务 - 解耦设计
 * 通过 IHistoryStorage 接口抽象存储层
 * 当前使用本地存储，二期替换为服务端接口只需实现新的 Storage
 */
import { getStorage, setStorage } from '@/utils/platform'

export interface ChatSession {
  id: string
  title: string
  messages: Array<{ role: string; content: string }>
  createdAt: number
  updatedAt: number
}

/** 存储层接口 - 解耦核心 */
export interface IHistoryStorage {
  getSessions(): Promise<ChatSession[]>
  getSession(id: string): Promise<ChatSession | null>
  saveSession(session: ChatSession): Promise<void>
  deleteSession(id: string): Promise<void>
  clearAll(): Promise<void>
}

const STORAGE_KEY = 'chat_sessions'

/** 本地存储实现 */
class LocalHistoryStorage implements IHistoryStorage {
  async getSessions(): Promise<ChatSession[]> {
    const data = getStorage<ChatSession[]>(STORAGE_KEY)
    return Array.isArray(data) ? data.sort((a, b) => b.updatedAt - a.updatedAt) : []
  }

  async getSession(id: string): Promise<ChatSession | null> {
    const sessions = await this.getSessions()
    return sessions.find((s) => s.id === id) || null
  }

  async saveSession(session: ChatSession): Promise<void> {
    const sessions = await this.getSessions()
    const idx = sessions.findIndex((s) => s.id === session.id)
    if (idx >= 0) {
      sessions[idx] = session
    } else {
      sessions.unshift(session)
    }
    setStorage(STORAGE_KEY, sessions.slice(0, 50))
  }

  async deleteSession(id: string): Promise<void> {
    const sessions = await this.getSessions()
    setStorage(STORAGE_KEY, sessions.filter((s) => s.id !== id))
  }

  async clearAll(): Promise<void> {
    setStorage(STORAGE_KEY, [])
  }
}

/** 预留：服务端存储实现（二期） */
// class ServerHistoryStorage implements IHistoryStorage {
//   async getSessions() { return request({ url: '/api/history' }) }
//   async saveSession(s) { return request({ url: '/api/history', method: 'POST', data: s }) }
//   ...
// }

let storageInstance: IHistoryStorage | null = null

export function getHistoryService(): IHistoryStorage {
  if (!storageInstance) {
    storageInstance = new LocalHistoryStorage()
  }
  return storageInstance
}

export function setHistoryStorage(storage: IHistoryStorage): void {
  storageInstance = storage
}
