/**
 * 模型服务 - 根据配置选择具体 Provider
 * 业务层只依赖此服务，不直接依赖具体 Provider
 */
import type { IModelProvider } from '@/providers/IModelProvider'
import type { ChatParams, ChatResponse } from './types'
import { DeepSeekProvider } from '@/providers/DeepSeekProvider'
import { QwenProvider } from '@/providers/QwenProvider'
import { LocalModelProvider } from '@/providers/LocalModelProvider'
import { getStorage, setStorage } from '@/utils/platform'
import { config } from '@/constants/config'
import { modelsConfig } from '@/config/models.config'

const allProviders: Record<string, IModelProvider> = {
  deepseek: new DeepSeekProvider(),
  qwen: new QwenProvider(),
  local: new LocalModelProvider()
}

/** 仅返回已启用的 provider */
function getProviders(): Record<string, IModelProvider> {
  const enabled: Record<string, IModelProvider> = {}
  if (modelsConfig.qwen.enabled) enabled.qwen = allProviders.qwen
  if (modelsConfig.deepseek.enabled) enabled.deepseek = allProviders.deepseek
  enabled.local = allProviders.local
  return enabled
}

const providers = getProviders()

export function getModelService(): ModelService {
  return ModelService.instance
}

export class ModelService {
  static instance = new ModelService()

  private _currentProviderId: string

  private constructor() {
    const saved = getStorage<string>(config.storageKeys.selectedModel)
    const defaultId = modelsConfig.qwen.enabled ? 'qwen' : (modelsConfig.deepseek.enabled ? 'deepseek' : 'local')
    this._currentProviderId = saved && providers[saved] ? saved : defaultId
  }

  get currentProviderId(): string {
    return this._currentProviderId
  }

  setCurrentProvider(id: string): void {
    if (providers[id]) {
      this._currentProviderId = id
      setStorage(config.storageKeys.selectedModel, id)
    }
  }

  getProvider(id?: string): IModelProvider {
    const pid = id || this._currentProviderId
    return providers[pid] || providers.qwen || providers.deepseek || providers.local
  }

  getAvailableProviders(): IModelProvider[] {
    return Object.values(providers)
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const provider = this.getProvider()
    return provider.chat(params)
  }

  async *chatStream(params: ChatParams): AsyncGenerator<string, void, unknown> {
    const provider = this.getProvider()
    if (provider.chatStream) {
      yield* provider.chatStream(params)
    } else {
      const res = await provider.chat(params)
      yield res.content
    }
  }
}
