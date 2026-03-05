/**
 * 解析路由 - POST /api/parse
 *
 * 双通道解析管线：
 *   通道 A（快速）: pdf-parse 提取纯文本 → 立即返回 reportId
 *   通道 B（异步）: PDF 转图片 → Qwen-VL 视觉识别 → 结构化内容
 *
 * 流程：
 *   1. 用户上传 PDF 或粘贴文本
 *   2. 立即用 pdf-parse 提取纯文本，创建报告记录（status=parsing）
 *   3. 返回 reportId 给前端（不阻塞）
 *   4. 后台异步执行：
 *      a. PDF 转图片（pdfImageService）
 *      b. 逐页视觉识别（visionService）
 *      c. 合并结果存入 structured_content
 *      d. 触发 RAG 索引（使用增强文本）
 *      e. 更新 status 为 analyzed
 *
 * 降级策略：
 *   - VL_ENABLED=false 时跳过视觉识别，只用纯文本
 *   - 视觉识别失败时降级为纯文本模式
 *   - 任何异常都不影响主流程返回
 */
import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { config } from '../config'
import { parsePdf } from '../services/pdfService'
import { createReport, updateStructuredContent, updateReportStatus } from '../services/reportStore'
import { pdfToImages } from '../services/pdfImageService'
import { extractAllPages, mergeVisionToText } from '../services/visionService'

export const parseRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxPdfSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('仅支持 PDF 文件'))
    }
  },
})

parseRouter.post(
  '/parse',
  (req: Request, res: Response, next: NextFunction) => {
    const ct = req.headers['content-type'] || ''
    if (ct.includes('multipart/form-data')) {
      return upload.single('file')(req, res, next)
    }
    next()
  },
  async (req: Request, res: Response) => {
    try {
      let rawText = ''
      let source: 'pdf' | 'text' = 'text'
      let pages = 0
      let pdfBuffer: Buffer | null = null

      if (req.file) {
        const result = await parsePdf(req.file.buffer)
        rawText = result.text
        source = 'pdf'
        pages = result.pages
        pdfBuffer = req.file.buffer
      } else {
        const { text } = req.body || {}
        if (typeof text !== 'string' || !text.trim()) {
          return res.status(400).json({ success: false, error: '请上传 PDF 或提供 text 字段' })
        }
        rawText = text.trim()
      }

      if (!rawText) {
        return res.status(400).json({ success: false, error: '解析结果为空' })
      }

      // 创建报告记录（status=parsing 表示正在处理中）
      const report = createReport({
        title: rawText.slice(0, 50).replace(/\n/g, ' '),
        source,
        rawText,
        pages,
        status: 'parsing',
      })

      // 立即返回 reportId，后续处理异步进行
      res.json({
        success: true,
        reportId: report.id,
        text: report.rawText,
        source,
        pages,
        status: 'parsing',
      })

      // ===== 异步后台处理 =====
      processReportAsync(report.id, rawText, pdfBuffer).catch((e) => {
        console.error(`[Parse] 异步处理失败 (report ${report.id.slice(0, 8)}):`, e)
        updateReportStatus(report.id, 'error')
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '解析失败'
      res.status(500).json({ success: false, error: msg })
    }
  }
)

/**
 * 异步后台处理：视觉识别 + RAG 索引
 * 不阻塞 HTTP 响应，失败时降级
 */
async function processReportAsync(
  reportId: string,
  rawText: string,
  pdfBuffer: Buffer | null
): Promise<void> {
  let enhancedText = rawText
  let structuredResult: Record<string, unknown> | null = null

  // 通道 B：视觉识别（仅 PDF 且 VL 开启时）
  if (pdfBuffer && config.vlEnabled) {
    try {
      console.log(`[Parse] 开始视觉识别 (report ${reportId.slice(0, 8)})...`)

      // PDF 转图片
      const images = await pdfToImages(pdfBuffer, config.vlMaxPages)
      if (images.length > 0) {
        // Qwen-VL 逐页识别
        const visionResult = await extractAllPages(images)

        // 存储结构化内容
        structuredResult = visionResult as unknown as Record<string, unknown>
        updateStructuredContent(reportId, structuredResult)

        // 合并为增强文本（用于 RAG 索引）
        const visionText = mergeVisionToText(visionResult)
        if (visionText.trim().length > rawText.length * 0.5) {
          enhancedText = visionText
          console.log(`[Parse] 使用视觉增强文本 (${enhancedText.length} chars vs 原文 ${rawText.length} chars)`)
        } else {
          console.log('[Parse] 视觉文本过短，保留 pdf-parse 原文')
        }
      }
    } catch (e) {
      console.warn('[Parse] 视觉识别失败，降级为纯文本:', e instanceof Error ? e.message : e)
    }
  }

  // 建立 RAG 索引
  try {
    const { indexReport } = await import('../services/rag')
    const cnt = await indexReport(reportId, enhancedText, structuredResult)
    console.log(`[Parse] RAG 索引完成: ${cnt} 个块`)
  } catch (e) {
    console.warn('[Parse] RAG 索引失败（不影响主流程）:', e)
  }

  // 更新状态为已完成
  updateReportStatus(reportId, 'pending')
  console.log(`[Parse] 异步处理完成 (report ${reportId.slice(0, 8)})`)
}
