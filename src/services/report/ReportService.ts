/**
 * 研报分析服务 - 调用后端 API
 * 所有数据持久化在后端 SQLite，前端无状态
 */
import Taro from '@tarojs/taro'
import { config } from '@/constants/config'

const BASE = config.reportApiBase

/* ---------- 基础请求封装 ---------- */
async function request<T>(
  path: string,
  options: { method?: string; data?: Record<string, unknown> } = {}
): Promise<T> {
  const { method = 'GET', data } = options
  const res = await new Promise<Taro.request.SuccessCallbackResult>((resolve, reject) => {
    Taro.request({
      url: `${BASE}${path}`,
      method,
      data,
      header: { 'Content-Type': 'application/json' },
      timeout: 120000,
      success: resolve,
      fail: (e) => reject(new Error(e.errMsg || '网络错误'))
    })
  })
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as T
  }
  const err = (res.data as { error?: string })?.error || `HTTP ${res.statusCode}`
  throw new Error(err)
}

/* ---------- 类型定义 ---------- */
export interface ReportSummary {
  stockName?: string
  stockCode?: string
  reportTitle?: string
  institution?: string
  analyst?: string
  publishDate?: string
  rating?: string
  targetPrice?: string
  currentPrice?: string
  potentialGain?: string
  coreLogic?: string
  catalysts?: string[]
  risks?: string[]
  financialForecast?: { year: string; revenue?: string; profit?: string; eps?: string }[]
}

export interface ReportItem {
  id: string
  title: string
  source: string
  pages: number
  summary: ReportSummary | null
  createdAt: number
  updatedAt: number
}

export interface ReportDetail extends ReportItem {
  rawText: string
}

/* ---------- API 方法 ---------- */
export const reportService = {
  /** 上传 PDF → 解析 → 返回 reportId */
  async parsePdf(filePath: string): Promise<{ reportId: string }> {
    return new Promise((resolve, reject) => {
      Taro.uploadFile({
        url: `${BASE}/api/parse`,
        filePath,
        name: 'file',
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(res.data as string)
              if (data.success && data.reportId) {
                resolve({ reportId: data.reportId })
              } else {
                reject(new Error(data.error || 'PDF 解析失败'))
              }
            } catch {
              reject(new Error('解析响应失败'))
            }
          } else {
            reject(new Error(`上传失败: ${res.statusCode}`))
          }
        },
        fail: (e) => reject(new Error(e.errMsg || '上传失败'))
      })
    })
  },

  /** 粘贴文本 → 解析 → 返回 reportId */
  async parseText(text: string): Promise<{ reportId: string }> {
    const data = await request<{ success: boolean; reportId: string; error?: string }>('/api/parse', {
      method: 'POST',
      data: { text }
    })
    if (!data.success || !data.reportId) throw new Error(data.error || '解析失败')
    return { reportId: data.reportId }
  },

  /** 根据 reportId 生成摘要（后端自动从 DB 取原文、回写摘要） */
  async getSummary(reportId: string): Promise<ReportSummary> {
    const res = await request<{ success: boolean; summary: ReportSummary }>('/api/summary', {
      method: 'POST',
      data: { reportId }
    })
    if (!res.success || !res.summary) throw new Error('摘要生成失败')
    return res.summary
  },

  /** 研报对话（后端用 reportId 取上下文 + 持久化聊天记录） */
  async chat(
    reportId: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    const res = await request<{ content: string }>('/api/chat', {
      method: 'POST',
      data: { reportId, messages }
    })
    return res.content || ''
  },

  /** 获取研报列表 */
  async getReportList(): Promise<ReportItem[]> {
    const res = await request<{ success: boolean; data: ReportItem[] }>('/api/reports')
    return res.data || []
  },

  /** 获取研报详情 */
  async getReport(id: string): Promise<ReportDetail> {
    const res = await request<{ success: boolean; data: ReportDetail }>(`/api/reports/${id}`)
    if (!res.success || !res.data) throw new Error('研报不存在')
    return res.data
  },

  /** 删除研报 */
  async deleteReport(id: string): Promise<void> {
    await request<{ success: boolean }>(`/api/reports/${id}`, { method: 'DELETE' })
  },

  /** 获取聊天历史 */
  async getChatHistory(reportId: string): Promise<Array<{ role: string; content: string }>> {
    const res = await request<{ history: Array<{ role: string; content: string }> }>(`/api/chat/${reportId}/history`)
    return res.history || []
  }
}
