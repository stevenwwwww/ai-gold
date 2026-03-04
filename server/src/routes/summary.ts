/**
 * 摘要路由 - POST /api/summary
 * 传入 reportId，从数据库取原文 → 生成摘要 → 回写数据库
 */
import { Router, Request, Response } from 'express'
import { generateSummary } from '../services/summaryService'
import { getReport, updateReportSummary } from '../services/reportStore'

export const summaryRouter = Router()

summaryRouter.post('/summary', async (req: Request, res: Response) => {
  try {
    const { reportId, text } = req.body || {}

    let rawText = ''

    // 优先用 reportId 从数据库取
    if (reportId) {
      const report = getReport(reportId)
      if (!report) {
        return res.status(404).json({ success: false, error: '研报不存在' })
      }
      rawText = report.rawText
    } else if (typeof text === 'string' && text.trim()) {
      rawText = text.trim()
    } else {
      return res.status(400).json({ success: false, error: 'reportId 或 text 必填' })
    }

    const summary = await generateSummary(rawText)

    // 如果有 reportId，把摘要回写到数据库
    if (reportId) {
      updateReportSummary(reportId, summary as Record<string, unknown>)
      // 用摘要中的标题更新研报标题
      const title = summary.reportTitle || summary.stockName
      if (title) {
        const { getDb } = await import('../db')
        getDb().prepare('UPDATE reports SET title = ?, updated_at = ? WHERE id = ?')
          .run(title.slice(0, 100), Date.now(), reportId)
      }
    }

    res.json({ success: true, reportId, summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '摘要生成失败'
    res.status(500).json({ success: false, error: msg })
  }
})
