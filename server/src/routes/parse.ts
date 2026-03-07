/**
 * 解析路由 - POST /api/parse
 *
 * v3 架构：PDF 上传统一走 RAGFlow
 *
 * 流程：
 *   1. 用户上传 PDF 或粘贴文本
 *   2. pdf-parse 提取纯文本（用于本地预览/搜索）
 *   3. 同时将 PDF 上传到 RAGFlow 知识库，触发异步解析
 *   4. RAGFlow 使用 DeepDOC 解析 PDF（表格/图表/文字全自动）
 *   5. 立即返回 reportId 给前端
 *   6. 前端可轮询 /api/reports/:id/status 查看 RAGFlow 解析进度
 *
 * 降级策略：
 *   - RAGFlow 不可用时，降级为本地纯文本存储
 *   - 任何异常都不影响主流程返回
 */
import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { config } from '../config'
import { parsePdf } from '../services/pdfService'
import {
  createReport,
  updateReportStatus,
  updateRagflowIds,
} from '../services/reportStore'
import * as ragflow from '../services/ragflowService'

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
      let fileName = 'upload.pdf'

      if (req.file) {
        const result = await parsePdf(req.file.buffer)
        rawText = result.text
        source = 'pdf'
        pages = result.pages
        pdfBuffer = req.file.buffer
        fileName = req.file.originalname || 'upload.pdf'
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

      const report = createReport({
        title: rawText.slice(0, 50).replace(/\n/g, ' '),
        source,
        rawText,
        pages,
        status: 'parsing',
      })

      res.json({
        success: true,
        reportId: report.id,
        text: report.rawText,
        source,
        pages,
        status: 'parsing',
      })

      // 异步上传到 RAGFlow
      uploadToRagflow(report.id, pdfBuffer, fileName).catch((e) => {
        console.error(`[Parse] RAGFlow 上传失败 (report ${report.id.slice(0, 8)}):`, e)
        updateReportStatus(report.id, 'error')
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '解析失败'
      res.status(500).json({ success: false, error: msg })
    }
  }
)

/**
 * 异步上传 PDF 到 RAGFlow 并触发解析
 *
 * 步骤：
 *   1. 确定目标 dataset（使用默认或自动创建）
 *   2. 上传 PDF 到 RAGFlow
 *   3. 触发异步解析
 *   4. 记录 ragflow_document_id 和 ragflow_dataset_id
 *   5. 启动轮询检查解析状态
 */
async function uploadToRagflow(
  reportId: string,
  pdfBuffer: Buffer | null,
  fileName: string
): Promise<void> {
  if (!pdfBuffer) {
    updateReportStatus(reportId, 'pending')
    console.log(`[Parse] 纯文本模式，跳过 RAGFlow (report ${reportId.slice(0, 8)})`)
    return
  }

  if (!config.ragflowApiKey) {
    console.warn('[Parse] RAGFLOW_API_KEY 未配置，跳过 RAGFlow')
    updateReportStatus(reportId, 'pending')
    return
  }

  // 1. 确定 dataset
  let datasetId = config.ragflowDefaultDatasetId
  if (!datasetId) {
    console.log('[Parse] 未配置默认 dataset，尝试创建...')
    const ds = await ragflow.createDataset('stock-reports', {
      description: '股票研报知识库',
      chunk_method: 'naive',
      parser_config: { chunk_token_num: 512, layout_recognize: true },
    })
    datasetId = ds.id
    console.log(`[Parse] 创建 dataset: ${datasetId}`)
  }

  // 2. 上传文档
  console.log(`[Parse] 上传 PDF 到 RAGFlow: ${fileName} (${(pdfBuffer.length / 1024).toFixed(0)}KB)`)
  const docs = await ragflow.uploadDocument(datasetId, pdfBuffer, fileName)
  if (!docs.length) {
    throw new Error('RAGFlow 上传返回空文档列表')
  }
  const docId = docs[0].id
  console.log(`[Parse] RAGFlow 文档 ID: ${docId}`)

  // 3. 关联到本地记录
  updateRagflowIds(reportId, docId, datasetId)

  // 4. 触发解析
  await ragflow.triggerParsing(datasetId, [docId])
  console.log(`[Parse] 已触发 RAGFlow 解析 (doc ${docId.slice(0, 8)})`)

  // 5. 轮询解析进度
  await pollParsingStatus(reportId, datasetId, docId)
}

/**
 * 轮询 RAGFlow 文档解析状态
 * 每 5 秒检查一次，最多等 10 分钟
 */
async function pollParsingStatus(
  reportId: string,
  datasetId: string,
  documentId: string
): Promise<void> {
  const MAX_POLLS = 120
  const INTERVAL = 5000

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, INTERVAL))

    try {
      const doc = await ragflow.getDocumentStatus(datasetId, documentId)
      if (!doc) continue

      const progress = doc.progress ?? 0
      console.log(`[Parse] RAGFlow 解析进度: ${(progress * 100).toFixed(0)}% (${doc.run})`)

      if (doc.run === '2' || progress >= 1) {
        if (doc.progress_msg && doc.progress_msg.toLowerCase().includes('error')) {
          console.error(`[Parse] RAGFlow 解析出错: ${doc.progress_msg}`)
          updateReportStatus(reportId, 'error')
        } else {
          updateReportStatus(reportId, 'analyzed')
          console.log(`[Parse] RAGFlow 解析完成 (report ${reportId.slice(0, 8)}, chunks: ${doc.chunk_count})`)
        }
        return
      }

      if (doc.run === '3') {
        console.warn('[Parse] RAGFlow 解析被取消')
        updateReportStatus(reportId, 'error')
        return
      }
    } catch (e) {
      console.warn(`[Parse] 轮询状态出错 (${i + 1}/${MAX_POLLS}):`, e)
    }
  }

  console.warn('[Parse] 轮询超时（10 分钟）')
  updateReportStatus(reportId, 'error')
}
