/**
 * 解析路由 - POST /api/parse
 * 接收 PDF 或文本 → 解析 → 存入数据库 → 返回 reportId
 * 预留：?source=url 链接解析
 */
import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { config } from '../config'
import { parsePdf } from '../services/pdfService'
import { createReport } from '../services/reportStore'

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

      if (req.file) {
        const result = await parsePdf(req.file.buffer)
        rawText = result.text
        source = 'pdf'
        pages = result.pages
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
      })

      res.json({
        success: true,
        reportId: report.id,
        text: report.rawText,
        source,
        pages,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '解析失败'
      res.status(500).json({ success: false, error: msg })
    }
  }
)
