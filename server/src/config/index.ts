/**
 * 配置聚合 - 从环境变量读取，支持多环境
 */
import 'dotenv/config'
import path from 'path'

function intEnv(key: string, fallback: number): number {
  const v = parseInt(process.env[key] || '', 10)
  return Number.isNaN(v) ? fallback : v
}

export const config = {
  // 服务
  port: intEnv('PORT', 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  get isDev() { return this.nodeEnv === 'development' },

  // LLM
  qwenApiKey: process.env.QWEN_API_KEY || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  defaultModel: process.env.DEFAULT_MODEL || 'qwen-plus',

  // LLM 参数
  llmTimeout: intEnv('LLM_TIMEOUT_MS', 120_000),
  llmMaxRetries: intEnv('LLM_MAX_RETRIES', 2),
  llmDefaultTemp: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
  llmDefaultMaxTokens: intEnv('LLM_MAX_TOKENS', 4096),
  summaryMaxInputChars: intEnv('SUMMARY_MAX_INPUT_CHARS', 30_000),

  // PDF
  maxPdfSizeMb: intEnv('MAX_PDF_SIZE_MB', 10),

  // 数据库
  dbPath: process.env.DB_PATH || path.join(process.cwd(), 'data', 'reports.db'),

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Body 限制
  bodyLimit: process.env.BODY_LIMIT || '15mb',

  // JWT 认证
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // 默认超管（首次启动自动创建）
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

  // 视觉模型（Qwen-VL）— PDF 图表/表格识别
  vlModel: process.env.VL_MODEL || 'qwen-vl-max',
  vlEnabled: (process.env.VL_ENABLED || 'true') === 'true',
  vlMaxPages: intEnv('VL_MAX_PAGES', 30),

  // 多研报联合检索
  multiReportMax: intEnv('MULTI_REPORT_MAX', 5),
} as const
