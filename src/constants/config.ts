/**
 * 应用配置常量
 *
 * REPORT_API_BASE / API_BASE 由 Taro defineConstants 编译时注入（见 config/dev.js、config/prod.js）
 * 它们是全局标识符，直接使用即可，不要通过 process.env 访问
 */

/* eslint-disable no-undef */
declare const API_BASE: string
declare const REPORT_API_BASE: string

export const config = {
  apiBase: typeof API_BASE !== 'undefined' ? API_BASE : 'https://dev-api.example.com',
  reportApiBase: typeof REPORT_API_BASE !== 'undefined' ? REPORT_API_BASE : 'http://localhost:3000',
  storageKeys: {
    selectedModel: 'selected_model',
    chatHistory: 'chat_history',
    userToken: 'user_token',
    reportList: 'report_list'
  },
  modelIds: ['deepseek', 'qwen', 'local'] as const
} as const
