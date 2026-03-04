/**
 * 应用配置常量
 * API 地址等敏感配置应通过 BFF/云函数转发，不直接暴露
 */
export const config = {
  // API 基础地址（开发阶段可配置，生产需通过 BFF 转发）
  apiBase: process.env.NODE_ENV === 'production'
    ? 'https://api.example.com'
    : 'https://dev-api.example.com',
  // 存储 key
  storageKeys: {
    selectedModel: 'selected_model',
    chatHistory: 'chat_history',
    userToken: 'user_token'
  },
  // 模型 ID 枚举
  modelIds: ['deepseek', 'qwen', 'local'] as const
} as const
