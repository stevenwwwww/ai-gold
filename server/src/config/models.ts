/**
 * LLM 模型配置 - 支持多 provider 切换
 */
export const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'

export interface ModelConfig {
  id: string
  name: string
  baseUrl: string
  modelName: string
}

export const modelConfigs: Record<string, ModelConfig> = {
  'qwen-plus': {
    id: 'qwen',
    name: '通义千问',
    baseUrl: QWEN_BASE_URL,
    modelName: 'qwen-plus',
  },
  'qwen-turbo': {
    id: 'qwen',
    name: '通义千问',
    baseUrl: QWEN_BASE_URL,
    modelName: 'qwen-turbo',
  },
  'deepseek-chat': {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: DEEPSEEK_BASE_URL,
    modelName: 'deepseek-chat',
  },
}
