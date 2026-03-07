/**
 * RAGFlow API 服务层 — 封装所有与 RAGFlow 的交互
 *
 * RAGFlow 是一个开源 RAG 引擎，通过 Docker 独立部署。
 * 本服务通过 HTTP API 与其通信，替代原有本地 RAG 管线。
 *
 * API 文档：https://ragflow.io/docs/http_api_reference
 *
 * 替代关系：
 *   旧 chunker.ts + embedder.ts + vectorStore.ts → ragflowService.ts
 *   旧 pdfImageService.ts + visionService.ts     → RAGFlow DeepDOC 内置解析
 *
 * 核心能力：
 *   1. Dataset（知识库）CRUD
 *   2. Document（文档）上传 / 解析 / 管理
 *   3. Retrieval（检索）— 混合检索 + Rerank
 *   4. Chat（对话）— 带原文引用（reference + positions）
 */

import { config } from '../config'
import FormData from 'form-data'

/* ========== 类型定义 ========== */

export interface RagflowDataset {
  id: string
  name: string
  description: string | null
  embedding_model: string
  chunk_method: string
  chunk_count: number
  document_count: number
  token_num: number
  create_time: number
  update_time: number
  parser_config: Record<string, unknown>
  permission: string
  similarity_threshold: number
  vector_similarity_weight: number
}

export interface RagflowDocument {
  id: string
  name: string
  size: number
  type: string
  run: string
  status: string
  progress: number
  progress_msg: string
  chunk_count: number
  token_count: number
  create_time: string
  update_time: string
  source_type: string
}

export interface RagflowChunk {
  id: string
  content: string
  document_id: string
  document_name: string
  dataset_id: string
  similarity: number
  vector_similarity: number
  term_similarity: number
  positions: number[][]
  image_id?: string
}

/** Chat completion 返回的原文引用 */
export interface RagflowReference {
  chunks: Record<string, RagflowChunk>
  doc_aggs: Record<string, { doc_name: string; doc_id: string; count: number }>
}

export interface RagflowChatResponse {
  content: string
  reference?: RagflowReference
}

export interface RagflowChat {
  id: string
  name: string
  dataset_ids: string[]
  create_time: number
  update_time: number
  llm: Record<string, unknown>
  prompt: Record<string, unknown>
}

/* ========== 内部工具 ========== */

function getBaseUrl(): string {
  return config.ragflowBaseUrl || 'http://localhost:9380'
}

function getApiKey(): string {
  const key = config.ragflowApiKey
  if (!key) throw new Error('未配置 RAGFLOW_API_KEY')
  return key
}

function headers(contentType = 'application/json'): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${getApiKey()}`,
  }
  if (contentType) h['Content-Type'] = contentType
  return h
}

/**
 * 统一请求封装，处理错误码
 */
async function ragflowFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBaseUrl()}/api/v1${path}`
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(), ...(options.headers as Record<string, string> || {}) },
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`RAGFlow API ${res.status}: ${errText.slice(0, 500)}`)
  }

  const data = await res.json() as { code: number; message?: string; data?: T }
  if (data.code !== 0) {
    throw new Error(`RAGFlow error ${data.code}: ${data.message || 'Unknown'}`)
  }
  return data.data as T
}

/* ========== Dataset（知识库）管理 ========== */

/**
 * 创建知识库
 * @param name 知识库名称
 * @param opts 可选配置（chunk_method, embedding_model 等）
 */
export async function createDataset(
  name: string,
  opts?: {
    description?: string
    chunk_method?: string
    parser_config?: Record<string, unknown>
    embedding_model?: string
  }
): Promise<RagflowDataset> {
  return ragflowFetch<RagflowDataset>('/datasets', {
    method: 'POST',
    body: JSON.stringify({ name, ...opts }),
  })
}

/** 列出知识库 */
export async function listDatasets(
  opts?: { page?: number; page_size?: number; name?: string }
): Promise<RagflowDataset[]> {
  const params = new URLSearchParams()
  if (opts?.page) params.set('page', String(opts.page))
  if (opts?.page_size) params.set('page_size', String(opts.page_size))
  if (opts?.name) params.set('name', opts.name)
  const qs = params.toString()
  return ragflowFetch<RagflowDataset[]>(`/datasets${qs ? `?${qs}` : ''}`)
}

/** 更新知识库 */
export async function updateDataset(
  datasetId: string,
  updates: { name?: string; description?: string; chunk_method?: string; parser_config?: Record<string, unknown> }
): Promise<void> {
  await ragflowFetch(`/datasets/${datasetId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

/** 删除知识库 */
export async function deleteDatasets(ids: string[]): Promise<void> {
  await ragflowFetch('/datasets', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  })
}

/* ========== Document（文档）管理 ========== */

/**
 * 上传文档到知识库
 * RAGFlow 接受 multipart/form-data，file 字段
 */
export async function uploadDocument(
  datasetId: string,
  fileBuffer: Buffer,
  fileName: string
): Promise<RagflowDocument[]> {
  const form = new FormData()
  form.append('file', fileBuffer, {
    filename: fileName,
    contentType: 'application/pdf',
  })

  const url = `${getBaseUrl()}/api/v1/datasets/${datasetId}/documents`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      ...form.getHeaders(),
    },
    body: form as unknown as BodyInit,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`RAGFlow upload ${res.status}: ${errText.slice(0, 500)}`)
  }

  const data = await res.json() as { code: number; data?: RagflowDocument[]; message?: string }
  if (data.code !== 0) {
    throw new Error(`RAGFlow upload error: ${data.message}`)
  }
  return data.data || []
}

/** 列出知识库中的文档 */
export async function listDocuments(
  datasetId: string,
  opts?: { page?: number; page_size?: number; name?: string }
): Promise<{ total: number; docs: RagflowDocument[] }> {
  const params = new URLSearchParams()
  if (opts?.page) params.set('page', String(opts.page))
  if (opts?.page_size) params.set('page_size', String(opts.page_size))
  if (opts?.name) params.set('name', opts.name)
  const qs = params.toString()

  const url = `${getBaseUrl()}/api/v1/datasets/${datasetId}/documents${qs ? `?${qs}` : ''}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`RAGFlow listDocs ${res.status}`)
  const data = await res.json() as {
    code: number; data?: { total: number; docs: RagflowDocument[] }; message?: string
  }
  if (data.code !== 0) throw new Error(`RAGFlow: ${data.message}`)
  return data.data || { total: 0, docs: [] }
}

/** 删除文档 */
export async function deleteDocuments(datasetId: string, documentIds: string[]): Promise<void> {
  await ragflowFetch(`/datasets/${datasetId}/documents`, {
    method: 'DELETE',
    body: JSON.stringify({ ids: documentIds }),
  })
}

/**
 * 触发文档解析（异步）
 * RAGFlow 会在后台执行 PDF 解析、分块、Embedding
 */
export async function triggerParsing(datasetId: string, documentIds: string[]): Promise<void> {
  await ragflowFetch(`/datasets/${datasetId}/documents/parse`, {
    method: 'POST',
    body: JSON.stringify({ document_ids: documentIds }),
  })
}

/** 取消文档解析 */
export async function cancelParsing(datasetId: string, documentIds: string[]): Promise<void> {
  await ragflowFetch(`/datasets/${datasetId}/documents/parse/cancel`, {
    method: 'POST',
    body: JSON.stringify({ document_ids: documentIds }),
  })
}

/**
 * 获取文档解析状态
 * 返回文档列表中的 run 字段：
 *   - '0' 或 空 = 未解析
 *   - '1' = 解析中
 *   - '2' = 解析完成（可能失败，看 progress_msg）
 *   - '3' = 取消
 */
export async function getDocumentStatus(
  datasetId: string,
  documentId: string
): Promise<RagflowDocument | null> {
  const result = await listDocuments(datasetId, { page: 1, page_size: 1 })
  // listDocuments 不支持按 id 筛选，需要遍历或用 name 筛选
  // 这里通过获取全量列表中查找
  const allDocs = await listDocuments(datasetId, { page: 1, page_size: 100 })
  return allDocs.docs.find((d) => d.id === documentId) || null
}

/* ========== Retrieval（检索） ========== */

/**
 * 检索知识库中最相关的分块
 * 使用 RAGFlow 的混合检索（向量 + BM25 关键词）
 */
export async function retrieve(
  question: string,
  datasetIds: string[],
  opts?: {
    document_ids?: string[]
    top_k?: number
    similarity_threshold?: number
    vector_similarity_weight?: number
    keyword?: boolean
  }
): Promise<{ chunks: RagflowChunk[]; total: number }> {
  const body: Record<string, unknown> = {
    question,
    dataset_ids: datasetIds,
    top_k: opts?.top_k ?? 10,
    similarity_threshold: opts?.similarity_threshold ?? 0.2,
    vector_similarity_weight: opts?.vector_similarity_weight ?? 0.3,
    keyword: opts?.keyword ?? true,
  }
  if (opts?.document_ids) body.document_ids = opts.document_ids

  const url = `${getBaseUrl()}/api/v1/retrieval`
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`RAGFlow retrieval ${res.status}`)
  const data = await res.json() as {
    code: number
    data?: { chunks: RagflowChunk[]; total: number }
    message?: string
  }
  if (data.code !== 0) throw new Error(`RAGFlow retrieval: ${data.message}`)
  return data.data || { chunks: [], total: 0 }
}

/* ========== Chat（对话 — 带原文引用） ========== */

/**
 * 创建 Chat Assistant（关联知识库）
 * 创建后获得 chatId，后续所有对话通过此 chatId 进行
 */
export async function createChat(
  name: string,
  datasetIds: string[],
  opts?: {
    llm?: Record<string, unknown>
    prompt?: Record<string, unknown>
  }
): Promise<RagflowChat> {
  return ragflowFetch<RagflowChat>('/chats', {
    method: 'POST',
    body: JSON.stringify({
      name,
      dataset_ids: datasetIds,
      ...opts,
    }),
  })
}

/** 列出 Chat Assistants */
export async function listChats(): Promise<RagflowChat[]> {
  return ragflowFetch<RagflowChat[]>('/chats')
}

/** 删除 Chat Assistants */
export async function deleteChats(ids: string[]): Promise<void> {
  await ragflowFetch('/chats', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  })
}

/**
 * Chat Completion — 核心对话接口
 *
 * 使用 OpenAI 兼容格式，额外通过 extra_body.reference 获取原文引用
 * 返回的 reference.chunks 包含每个引用片段的：
 *   - content: 原文内容
 *   - document_name: 来源文档名
 *   - positions: PDF 页码坐标
 *   - similarity: 相关度评分
 */
export async function chatCompletion(
  chatId: string,
  messages: Array<{ role: string; content: string }>,
  opts?: { stream?: boolean; sessionId?: string }
): Promise<RagflowChatResponse> {
  const url = `${getBaseUrl()}/api/v1/chats_openai/${chatId}/chat/completions`
  const body = {
    model: 'model',
    messages,
    stream: opts?.stream ?? false,
    extra_body: {
      reference: true,
    },
    ...(opts?.sessionId ? { session_id: opts.sessionId } : {}),
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`RAGFlow chat ${res.status}: ${errText.slice(0, 500)}`)
  }

  const data = await res.json() as {
    choices?: Array<{
      message?: {
        content?: string
        reference?: RagflowReference
      }
    }>
    code?: number
    message?: string
  }

  if (data.code && data.code !== 0) {
    throw new Error(`RAGFlow chat error: ${data.message}`)
  }

  const choice = data.choices?.[0]
  return {
    content: choice?.message?.content || '',
    reference: choice?.message?.reference,
  }
}

/* ========== Document Download ========== */

/**
 * 下载文档原始文件（PDF）
 * RAGFlow 将文件存储在 MinIO，可通过 API 获取
 * 返回文件的 ArrayBuffer
 */
export async function downloadDocument(
  datasetId: string,
  documentId: string
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  const url = `${getBaseUrl()}/api/v1/datasets/${datasetId}/documents/${documentId}/download`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  })

  if (!res.ok) {
    throw new Error(`RAGFlow download ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const contentType = res.headers.get('content-type') || 'application/pdf'
  const disposition = res.headers.get('content-disposition') || ''
  const nameMatch = disposition.match(/filename[^;=\n]*=["']?([^"';\n]*)/)
  const fileName = nameMatch ? decodeURIComponent(nameMatch[1]) : 'document.pdf'

  const arrayBuffer = await res.arrayBuffer()
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
    fileName,
  }
}

/* ========== Chunk（分块）管理 ========== */

/** 列出文档的分块 */
export async function listChunks(
  datasetId: string,
  documentId: string,
  opts?: { page?: number; page_size?: number; keywords?: string }
): Promise<{ total: number; chunks: RagflowChunk[] }> {
  const params = new URLSearchParams()
  if (opts?.page) params.set('page', String(opts.page))
  if (opts?.page_size) params.set('page_size', String(opts.page_size))
  if (opts?.keywords) params.set('keywords', opts.keywords)
  const qs = params.toString()

  const url = `${getBaseUrl()}/api/v1/datasets/${datasetId}/documents/${documentId}/chunks${qs ? `?${qs}` : ''}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`RAGFlow listChunks ${res.status}`)
  const data = await res.json() as { code: number; data?: { total: number; chunks: RagflowChunk[] } }
  if (data.code !== 0) throw new Error('RAGFlow listChunks error')
  return data.data || { total: 0, chunks: [] }
}

/* ========== 健康检查 ========== */

/** 检查 RAGFlow 服务是否可用 */
export async function healthCheck(): Promise<boolean> {
  try {
    const url = `${getBaseUrl()}/api/v1/datasets?page=1&page_size=1`
    const res = await fetch(url, {
      headers: headers(),
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}
