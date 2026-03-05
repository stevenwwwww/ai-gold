/**
 * 模型配置文件
 * 在此配置各模型的 API Key 和名称，填好后即可使用
 */

export interface ModelConfig {
  id: string
  name: string
  apiKey: string
  modelName: string
  baseUrl?: string
  enabled: boolean
}

/** 千问 DashScope API - 兼容 OpenAI 格式，支持流式返回 */
export const qwenConfig: ModelConfig = {
  id: 'qwen',
  name: '通义千问',
  apiKey: 'sk-557e3b0301ea460cb13e5160d1fcf897',
  modelName: 'qwen-plus', // qwen-turbo 更快，qwen-plus 质量更好
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  enabled: true
}

/** DeepSeek - 预留配置，填上 key 和 modelName 即可使用 */
export const deepseekConfig: ModelConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  apiKey: '', // 在此填入你的 DeepSeek API Key
  modelName: 'deepseek-chat', // 模型名称，如 deepseek-chat, deepseek-coder
  baseUrl: 'https://api.deepseek.com/v1',
  enabled: false // 填好 apiKey 后改为 true
}

export const modelsConfig = {
  qwen: qwenConfig,
  deepseek: deepseekConfig
}
