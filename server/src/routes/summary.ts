/**
 * 摘要路由
 * POST /api/summary      - 一页纸摘要（小程序用）
 * POST /api/deep-analysis - 6维度深度分析（Web端用，含图表数据）
 */
import { Router, Request, Response } from 'express'
import { generateSummary } from '../services/summaryService'
import { generateDeepAnalysis } from '../services/deepAnalysisService'
import { getReport, updateReportSummary, updateReportStatus } from '../services/reportStore'
import { getDb } from '../db'

export const summaryRouter = Router()

summaryRouter.post('/summary', async (req: Request, res: Response) => {
  try {
    const { reportId, text } = req.body || {}
    let rawText = ''

    if (reportId) {
      const report = getReport(reportId)
      if (!report) { res.status(404).json({ success: false, error: '研报不存在' }); return }
      rawText = report.rawText
    } else if (typeof text === 'string' && text.trim()) {
      rawText = text.trim()
    } else {
      res.status(400).json({ success: false, error: 'reportId 或 text 必填' }); return
    }

    const summary = await generateSummary(rawText, reportId)

    if (reportId) {
      updateReportSummary(reportId, summary as Record<string, unknown>)
      const title = summary.reportTitle || summary.stockName
      if (title) {
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

summaryRouter.post('/deep-analysis', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.body || {}
    if (!reportId) {
      res.status(400).json({ success: false, error: 'reportId 必填' }); return
    }

    const report = getReport(reportId)
    if (!report) {
      res.status(404).json({ success: false, error: '研报不存在' }); return
    }

    const analysis = await generateDeepAnalysis(
      report.rawText,
      reportId,
      report.structuredContent
    )

    const combined = { ...(report.summary || {}), deepAnalysis: analysis }
    updateReportSummary(reportId, combined)
    updateReportStatus(reportId, 'analyzed')

    const title = analysis.companyOverview?.name || analysis.summary?.coreLogic?.slice(0, 50)
    if (title) {
      getDb().prepare('UPDATE reports SET title = ?, updated_at = ? WHERE id = ?')
        .run(title.slice(0, 100), Date.now(), reportId)
    }

    res.json({ success: true, reportId, analysis })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '深度分析失败'
    res.status(500).json({ success: false, error: msg })
  }
})
