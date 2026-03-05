/**
 * 研报管理 API — Web 前端调用层
 *
 * 接口列表：
 *   - getReports()          搜索/筛选研报列表
 *   - getReport()           研报详情
 *   - deleteReport()        删除研报
 *   - batchDeleteReports()  批量删除
 *   - uploadPdf()           上传 PDF
 *   - parseText()           粘贴文本
 *   - generateSummary()     生成摘要
 *   - generateDeepAnalysis() 生成深度分析
 *   - updateAnalysis()      更新分析结果（前端编辑回写）
 *   - updateTitle()         更新标题
 *   - getReportStatus()     查询解析状态（轮询用）
 *   - getReportStats()      统计数据
 *   - chatWithReport()      单研报对话
 *   - multiReportChat()     多研报对话（结构化合成）
 *   - getChatHistory()      对话历史
 */
import request from './request'

/* ========== 类型定义 ========== */

export interface ChartData {
  type: 'bar' | 'line' | 'pie'
  title: string
  labels: string[]
  datasets: Array<{ label: string; data: number[] }>
}

export interface DeepAnalysis {
  companyOverview: {
    name: string; code: string; industry: string; mainBusiness: string
    marketCap?: string; highlights: string[]
  }
  industryAnalysis: {
    industryName: string; marketSize?: string; growthRate?: string
    trends: string[]; competitiveLandscape: string; companyPosition: string
  }
  financialAnalysis: {
    revenue?: { year: string; value: string }[]
    netProfit?: { year: string; value: string }[]
    grossMargin?: string; netMargin?: string; roe?: string; debtRatio?: string
    highlights: string[]; concerns: string[]
    revenueChart?: ChartData
    profitChart?: ChartData
  }
  valuationAnalysis: {
    currentPrice?: string; targetPrice?: string; pe?: string; pb?: string
    peg?: string; valuationMethod?: string; conclusion: string
  }
  summary: {
    rating: string; score: number; coreLogic: string
    catalysts: string[]; keyPoints: string[]
  }
  riskWarnings: {
    level: 'high' | 'medium' | 'low'
    risks: { category: string; description: string }[]
  }
}

export interface ReportItem {
  id: string
  title: string
  source: string
  pages: number
  summary: Record<string, unknown> | null
  structuredContent: Record<string, unknown> | null
  status: string
  createdAt: number
  updatedAt: number
  uploadedBy?: string
}

export interface ReportDetail extends ReportItem {
  rawText: string
  indexed?: boolean
}

export interface ReportStats {
  total: number
  analyzed: number
  pending: number
  avgScore: number
  thisMonth: number
}

export interface SynthesizedResult {
  conclusion: string
  keyData: Array<{ metric: string; value: string; source: string }>
  viewpoints: Array<{ institution: string; view: string; rating: string }>
  comparison: string
  risks: string[]
  sources: Array<{ reportId: string; title: string; chunkIndex: number }>
}

/* ========== API 调用 ========== */

export async function getReports(opts?: {
  keyword?: string; status?: string; sortBy?: string; limit?: number; offset?: number
}) {
  const { data } = await request.get<{ success: boolean; data: ReportItem[]; total: number }>(
    '/reports', { params: opts }
  )
  return data
}

export async function getReport(id: string) {
  const { data } = await request.get<{ success: boolean; data: ReportDetail }>(`/reports/${id}`)
  return data.data
}

export async function deleteReport(id: string) {
  await request.delete(`/reports/${id}`)
}

export async function batchDeleteReports(ids: string[]) {
  const { data } = await request.post<{ success: boolean; deleted: number }>('/reports/batch-delete', { ids })
  return data.deleted
}

export async function uploadPdf(file: File): Promise<{ reportId: string; status: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await request.post<{ success: boolean; reportId: string; status: string }>(
    '/parse', formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300_000 }
  )
  return { reportId: data.reportId, status: data.status }
}

export async function parseText(text: string): Promise<{ reportId: string }> {
  const { data } = await request.post<{ success: boolean; reportId: string }>('/parse', { text })
  return { reportId: data.reportId }
}

export async function generateSummary(reportId: string) {
  const { data } = await request.post('/summary', { reportId })
  return data.summary
}

export async function generateDeepAnalysis(reportId: string): Promise<DeepAnalysis> {
  const { data } = await request.post<{ success: boolean; analysis: DeepAnalysis }>(
    '/deep-analysis', { reportId }
  )
  return data.analysis
}

export async function updateAnalysis(reportId: string, analysis: DeepAnalysis) {
  await request.put(`/reports/${reportId}/analysis`, { analysis })
}

export async function updateTitle(reportId: string, title: string) {
  await request.put(`/reports/${reportId}`, { title })
}

export async function getReportStatus(reportId: string) {
  const { data } = await request.get<{
    success: boolean; status: string; indexed: boolean
    hasStructured: boolean; hasAnalysis: boolean
  }>(`/reports/${reportId}/status`)
  return data
}

export async function getReportStats(): Promise<ReportStats> {
  const { data } = await request.get<{ success: boolean; data: ReportStats }>('/reports/stats')
  return data.data
}

export async function chatWithReport(reportId: string, messages: { role: string; content: string }[]) {
  const { data } = await request.post<{ content: string; sources?: unknown[] }>('/chat', { reportId, messages })
  return data
}

export async function multiReportChat(
  reportIds: string[],
  messages: { role: string; content: string }[],
  structured = false
) {
  const { data } = await request.post<{
    content?: string
    type?: string
    data?: SynthesizedResult
    sources?: unknown[]
  }>('/chat', { reportIds, messages, structured })
  return data
}

export async function getChatHistory(reportId: string) {
  const { data } = await request.get<{ history: { role: string; content: string }[] }>(
    `/chat/${reportId}/history`
  )
  return data.history
}
