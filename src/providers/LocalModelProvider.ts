/**
 * 本地模型提供者 - 预留占位
 * 后续可接入 ONNX Runtime、llama.cpp 等本地推理方案
 */
import type { IModelProvider } from './IModelProvider'
import type { ChatParams, ChatResponse } from '@/services/model/types'

export class LocalModelProvider implements IModelProvider {
  id = 'local'
  name = '本地模型（预留）'
  stream = false

  async chat(_params: ChatParams): Promise<ChatResponse> {
    // 占位实现，后续接入本地推理
    return {
      content: '本地模型功能暂未开放，敬请期待。'
    }
  }
}
