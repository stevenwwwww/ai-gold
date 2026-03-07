/**
 * 知识库路由 - /api/knowledge/*
 *
 * 透传 RAGFlow 知识库管理 API，供 Web 前端调用
 *
 * 功能：
 *   1. Dataset（知识库）CRUD
 *   2. Document（文档）列表 / 删除 / 解析
 *   3. Chunk（分块）列表 / 搜索
 *   4. Retrieval（检索测试）
 *   5. RAGFlow 健康检查
 *   6. RAGFlow UI 地址
 */
import { Router, Request, Response } from 'express'
import multer from 'multer'
import { config } from '../config'
import * as ragflow from '../services/ragflowService'

export const knowledgeRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxPdfSizeMb * 1024 * 1024 },
})

/* ========== 健康检查 & 配置 ========== */

/** 检查 RAGFlow 服务状态 */
knowledgeRouter.get('/knowledge/health', async (_req: Request, res: Response) => {
  try {
    const ok = await ragflow.healthCheck()
    res.json({ healthy: ok, baseUrl: config.ragflowBaseUrl })
  } catch (e) {
    res.json({ healthy: false, error: e instanceof Error ? e.message : 'unknown' })
  }
})

/** 返回 RAGFlow UI 地址（供前端 iframe 嵌入） */
knowledgeRouter.get('/knowledge/ui-url', (_req: Request, res: Response) => {
  res.json({ url: config.ragflowUiUrl })
})

/* ========== Dataset（知识库）管理 ========== */

/** 列出所有知识库 */
knowledgeRouter.get('/knowledge/datasets', async (req: Request, res: Response) => {
  try {
    const { page, page_size, name } = req.query
    const datasets = await ragflow.listDatasets({
      page: page ? Number(page) : undefined,
      page_size: page_size ? Number(page_size) : undefined,
      name: name ? String(name) : undefined,
    })
    res.json({ success: true, data: datasets })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '查询失败' })
  }
})

/** 创建知识库 */
knowledgeRouter.post('/knowledge/datasets', async (req: Request, res: Response) => {
  try {
    const { name, description, chunk_method, parser_config, embedding_model } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'name 必填' })

    const ds = await ragflow.createDataset(name, {
      description,
      chunk_method,
      parser_config,
      embedding_model,
    })
    res.json({ success: true, data: ds })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '创建失败' })
  }
})

/** 更新知识库 */
knowledgeRouter.put('/knowledge/datasets/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, description, chunk_method, parser_config } = req.body
    await ragflow.updateDataset(id, { name, description, chunk_method, parser_config })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '更新失败' })
  }
})

/** 删除知识库 */
knowledgeRouter.delete('/knowledge/datasets', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids 必填' })
    }
    await ragflow.deleteDatasets(ids)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '删除失败' })
  }
})

/* ========== Document（文档）管理 ========== */

/** 列出知识库中的文档 */
knowledgeRouter.get('/knowledge/datasets/:datasetId/documents', async (req: Request, res: Response) => {
  try {
    const { datasetId } = req.params
    const { page, page_size, name } = req.query
    const result = await ragflow.listDocuments(datasetId, {
      page: page ? Number(page) : undefined,
      page_size: page_size ? Number(page_size) : undefined,
      name: name ? String(name) : undefined,
    })
    res.json({ success: true, data: result })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '查询失败' })
  }
})

/** 上传文档到知识库（并自动触发解析） */
knowledgeRouter.post(
  '/knowledge/datasets/:datasetId/documents',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { datasetId } = req.params
      if (!req.file) return res.status(400).json({ success: false, error: '请上传文件' })

      const docs = await ragflow.uploadDocument(
        datasetId,
        req.file.buffer,
        req.file.originalname || 'upload.pdf'
      )

      if (docs.length > 0) {
        await ragflow.triggerParsing(datasetId, docs.map((d) => d.id))
      }

      res.json({ success: true, data: docs })
    } catch (e) {
      res.status(500).json({ success: false, error: e instanceof Error ? e.message : '上传失败' })
    }
  }
)

/** 删除文档 */
knowledgeRouter.delete('/knowledge/datasets/:datasetId/documents', async (req: Request, res: Response) => {
  try {
    const { datasetId } = req.params
    const { ids } = req.body
    if (!Array.isArray(ids)) return res.status(400).json({ success: false, error: 'ids 必填' })

    await ragflow.deleteDocuments(datasetId, ids)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '删除失败' })
  }
})

/** 手动触发文档解析 */
knowledgeRouter.post('/knowledge/datasets/:datasetId/documents/parse', async (req: Request, res: Response) => {
  try {
    const { datasetId } = req.params
    const { document_ids } = req.body
    if (!Array.isArray(document_ids)) return res.status(400).json({ success: false, error: 'document_ids 必填' })

    await ragflow.triggerParsing(datasetId, document_ids)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '解析失败' })
  }
})

/** 取消文档解析 */
knowledgeRouter.post('/knowledge/datasets/:datasetId/documents/parse/cancel', async (req: Request, res: Response) => {
  try {
    const { datasetId } = req.params
    const { document_ids } = req.body
    await ragflow.cancelParsing(datasetId, document_ids || [])
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '取消失败' })
  }
})

/** 下载文档原始 PDF 文件 */
knowledgeRouter.get(
  '/knowledge/datasets/:datasetId/documents/:documentId/download',
  async (req: Request, res: Response) => {
    try {
      const { datasetId, documentId } = req.params
      const { buffer, contentType, fileName } = await ragflow.downloadDocument(datasetId, documentId)
      const isPdf = fileName.toLowerCase().endsWith('.pdf') || contentType.includes('pdf')
      res.setHeader('Content-Type', isPdf ? 'application/pdf' : contentType)
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`)
      res.setHeader('Content-Length', buffer.length)
      res.send(buffer)
    } catch (e) {
      res.status(500).json({ success: false, error: e instanceof Error ? e.message : '下载失败' })
    }
  }
)

/* ========== Chunk Image（分块图片代理） ========== */

/** 代理 RAGFlow 分块图片（图表/表格截图），imageId 格式: {kb_id}-{chunk_id} */
knowledgeRouter.get('/knowledge/chunk-image/:imageId', async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params
    const buffer = await ragflow.getChunkImage(imageId)
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(buffer)
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '获取图片失败' })
  }
})

/* ========== Chunk（分块）管理 ========== */

/** 列出文档的分块 */
knowledgeRouter.get(
  '/knowledge/datasets/:datasetId/documents/:documentId/chunks',
  async (req: Request, res: Response) => {
    try {
      const { datasetId, documentId } = req.params
      const { page, page_size, keywords } = req.query
      const result = await ragflow.listChunks(datasetId, documentId, {
        page: page ? Number(page) : undefined,
        page_size: page_size ? Number(page_size) : undefined,
        keywords: keywords ? String(keywords) : undefined,
      })
      res.json({ success: true, data: result })
    } catch (e) {
      res.status(500).json({ success: false, error: e instanceof Error ? e.message : '查询失败' })
    }
  }
)

/* ========== Retrieval（检索测试） ========== */

/** 执行知识库检索 */
knowledgeRouter.post('/knowledge/retrieval', async (req: Request, res: Response) => {
  try {
    const { question, dataset_ids, document_ids, top_k, similarity_threshold, vector_similarity_weight, keyword } = req.body
    if (!question || !Array.isArray(dataset_ids)) {
      return res.status(400).json({ success: false, error: 'question 和 dataset_ids 必填' })
    }

    const result = await ragflow.retrieve(question, dataset_ids, {
      document_ids,
      top_k,
      similarity_threshold,
      vector_similarity_weight,
      keyword,
    })

    res.json({ success: true, data: result })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '检索失败' })
  }
})

/* ========== Chat Assistant 管理 ========== */

/** 列出 Chat Assistants */
knowledgeRouter.get('/knowledge/chats', async (_req: Request, res: Response) => {
  try {
    const chats = await ragflow.listChats()
    res.json({ success: true, data: chats })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '查询失败' })
  }
})

/** 创建 Chat Assistant */
knowledgeRouter.post('/knowledge/chats', async (req: Request, res: Response) => {
  try {
    const { name, dataset_ids, llm, prompt } = req.body
    if (!name || !Array.isArray(dataset_ids)) {
      return res.status(400).json({ success: false, error: 'name 和 dataset_ids 必填' })
    }
    const chat = await ragflow.createChat(name, dataset_ids, { llm, prompt })
    res.json({ success: true, data: chat })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '创建失败' })
  }
})

/** 删除 Chat Assistants */
knowledgeRouter.delete('/knowledge/chats', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids)) return res.status(400).json({ success: false, error: 'ids 必填' })
    await ragflow.deleteChats(ids)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : '删除失败' })
  }
})
