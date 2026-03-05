/**
 * 研报 CRUD 路由 — 生产级接口
 *
 * 接口列表：
 *   GET    /api/reports              - 带搜索/筛选的列表（支持 keyword、status、sortBy）
 *   GET    /api/reports/stats        - 统计数据（总数、已分析、本月新增、平均评分）
 *   GET    /api/reports/:id          - 详情（含结构化内容）
 *   PUT    /api/reports/:id          - 更新标题
 *   PUT    /api/reports/:id/analysis - 更新分析结果（前端编辑后回写）
 *   DELETE /api/reports/:id          - 删除（含 RAG 索引清理）
 *   POST   /api/reports/:id/index    - 手动触发 RAG 索引
 *   GET    /api/reports/:id/index    - 查看索引状态
 *   POST   /api/reports/batch-delete - 批量删除
 *   GET    /api/reports/:id/status   - 查询解析状态（前端轮询用）
 */
import { Router, Request, Response } from 'express'
import {
  listReports, getReport, deleteReport, updateReportSummary,
  updateReportTitle, getReportStats, searchReports, countReports,
} from '../services/reportStore'
import { indexReport, hasChunks, deleteChunks } from '../services/rag'

export const reportsRouter = Router()

/** 研报列表（支持搜索参数） */
reportsRouter.get('/reports', (req: Request, res: Response) => {
  try {
    const keyword = req.query.keyword as string | undefined
    const status = req.query.status as string | undefined
    const sortBy = (req.query.sortBy as string) || 'time'
    const limit = Math.min(parseInt(String(req.query.limit)) || 50, 200)
    const offset = Math.max(parseInt(String(req.query.offset)) || 0, 0)

    const reports = searchReports({ keyword, status, limit, offset, sortBy })
    const total = countReports(keyword)

    const list = reports.map(({ rawText: _, ...rest }) => rest)
    res.json({ success: true, data: list, total })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '查询失败'
    res.status(500).json({ success: false, error: msg })
  }
})

/** 统计数据 */
reportsRouter.get('/reports/stats', (_req: Request, res: Response) => {
  try {
    const stats = getReportStats()
    res.json({ success: true, data: stats })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '统计失败'
    res.status(500).json({ success: false, error: msg })
  }
})

/** 研报详情 */
reportsRouter.get('/reports/:id', (req: Request, res: Response) => {
  try {
    const report = getReport(req.params.id)
    if (!report) {
      return res.status(404).json({ success: false, error: '研报不存在' })
    }
    const indexed = hasChunks(req.params.id)
    res.json({ success: true, data: { ...report, indexed } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '查询失败'
    res.status(500).json({ success: false, error: msg })
  }
})

/** 更新研报标题 */
reportsRouter.put('/reports/:id', (req: Request, res: Response) => {
  try {
    const report = getReport(req.params.id)
    if (!report) {
      return res.status(404).json({ success: false, error: '研报不存在' })
    }
    const { title } = req.body || {}
    if (typeof title === 'string' && title.trim()) {
      updateReportTitle(req.params.id, title.trim())
    }
    res.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '更新失败'
    res.status(500).json({ success: false, error: msg })
  }
})

/**
 * 更新分析结果（前端编辑后回写）
 * 前端编辑图表数据/表格/6维度内容后，调用此接口保存
 */
reportsRouter.put('/reports/:id/analysis', (req: Request, res: Response) => {
  try {
    const report = getReport(req.params.id)
    if (!report) {
      return res.status(404).json({ success: false, error: '研报不存在' })
    }
    const { analysis } = req.body || {}
    if (!analysis || typeof analysis !== 'object') {
      return res.status(400).json({ success: false, error: 'analysis 字段必填且为对象' })
    }

    const combined = { ...(report.summary || {}), deepAnalysis: analysis }
    updateReportSummary(req.params.id, combined)

    res.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '更新失败'
    res.status(500).json({ success: false, error: msg })
  }
})

/** 删除研报 */
reportsRouter.delete('/reports/:id', (req: Request, res: Response) => {
  try {
    deleteChunks(req.params.id)
    const deleted = deleteReport(req.params.id)
    if (!deleted) {
      res.status(404).json({ success: false, error: '研报不存在' }); return
    }
    res.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '删除失败'
    res.status(500).json({ success: false, error: msg })
  }
})

/** 批量删除 */
reportsRouter.post('/reports/batch-delete', (req: Request, res: Response) => {
  try {
    const { ids } = req.body || {}
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids 必填且为非空数组' })
    }
    let deleted = 0
    for (const id of ids) {
      deleteChunks(String(id))
      if (deleteReport(String(id))) deleted++
    }
    res.json({ success: true, deleted })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '批量删除失败'
    res.status(500).json({ success: false, error: msg })
  }
})

/** 查看 RAG 索引状态 */
reportsRouter.get('/reports/:id/index', (req: Request, res: Response) => {
  try {
    const report = getReport(req.params.id)
    if (!report) { res.status(404).json({ error: '研报不存在' }); return }
    const indexed = hasChunks(req.params.id)
    res.json({ success: true, indexed, reportId: req.params.id })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '查询失败' })
  }
})

/** 手动触发 RAG 索引 */
reportsRouter.post('/reports/:id/index', async (req: Request, res: Response) => {
  try {
    const report = getReport(req.params.id)
    if (!report) { res.status(404).json({ error: '研报不存在' }); return }
    const count = await indexReport(report.id, report.rawText, report.structuredContent)
    res.json({ success: true, reportId: req.params.id, chunks: count })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '索引失败' })
  }
})

/** 查询研报解析状态（前端轮询用） */
reportsRouter.get('/reports/:id/status', (req: Request, res: Response) => {
  try {
    const report = getReport(req.params.id)
    if (!report) { res.status(404).json({ error: '研报不存在' }); return }
    const indexed = hasChunks(req.params.id)
    res.json({
      success: true,
      status: report.status,
      indexed,
      hasStructured: !!report.structuredContent,
      hasAnalysis: !!(report.summary as Record<string, unknown>)?.deepAnalysis,
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '查询失败' })
  }
})
