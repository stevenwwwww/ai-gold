/**
 * 研报 CRUD 路由
 * GET    /api/reports          - 列表
 * GET    /api/reports/:id      - 详情
 * DELETE /api/reports/:id      - 删除
 */
import { Router, Request, Response } from 'express'
import { listReports, getReport, deleteReport } from '../services/reportStore'

export const reportsRouter = Router()

reportsRouter.get('/reports', (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit)) || 50, 200)
    const offset = Math.max(parseInt(String(req.query.offset)) || 0, 0)
    const reports = listReports(limit, offset)
    // 列表不返回 rawText 避免数据量过大
    const list = reports.map(({ rawText: _, ...rest }) => rest)
    res.json({ success: true, data: list, total: list.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '查询失败'
    res.status(500).json({ success: false, error: msg })
  }
})

reportsRouter.get('/reports/:id', (req: Request, res: Response) => {
  try {
    const report = getReport(req.params.id)
    if (!report) {
      return res.status(404).json({ success: false, error: '研报不存在' })
    }
    res.json({ success: true, data: report })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '查询失败'
    res.status(500).json({ success: false, error: msg })
  }
})

reportsRouter.delete('/reports/:id', (req: Request, res: Response) => {
  try {
    const deleted = deleteReport(req.params.id)
    if (!deleted) {
      return res.status(404).json({ success: false, error: '研报不存在' })
    }
    res.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '删除失败'
    res.status(500).json({ success: false, error: msg })
  }
})
