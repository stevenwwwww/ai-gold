/**
 * 爬虫配置 - 从环境变量读取
 */
import path from 'path'

export const crawlerConfig = {
  // RAGFlow
  ragflowBaseUrl: process.env.RAGFLOW_BASE_URL || 'http://localhost:9380',
  ragflowApiKey: process.env.RAGFLOW_API_KEY || '',
  ragflowDatasetId: process.env.RAGFLOW_MEDICAL_DATASET_ID || process.env.RAGFLOW_DEFAULT_DATASET_ID || '',

  // NCBI 礼貌使用（必填以符合 API 政策）
  ncbiEmail: process.env.NCBI_EMAIL || 'crawler@example.com',

  // 抓取节奏：NCBI 建议 3 次/秒
  ncbiDelayMs: parseInt(process.env.NCBI_DELAY_MS || '400', 10),

  // 每轮最多抓取篇数
  batchSize: parseInt(process.env.CRAWLER_BATCH_SIZE || '20', 10),

  // 定时轮次间隔（毫秒），默认每小时
  intervalMs: parseInt(process.env.CRAWLER_INTERVAL_MS || String(60 * 60 * 1000), 10),

  // 状态存储路径
  statePath: process.env.CRAWLER_STATE_PATH || path.join(process.cwd(), 'data', 'crawler_state.db'),

  // 默认检索词（医学主题）
  defaultQueries: (process.env.CRAWLER_QUERIES || 'diabetes,hypertension,COVID-19').split(',').map((q) => q.trim()),
} as const
