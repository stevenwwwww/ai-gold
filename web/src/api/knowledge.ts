/**
 * 知识库 API — 对接后端 /api/knowledge/* 路由
 */
import request from './request'

/* ========== 类型 ========== */

export interface Dataset {
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
}

export interface Document {
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
}

export interface Chunk {
  id: string
  content: string
  document_id: string
  document_name: string
  dataset_id: string
  similarity: number
  positions: number[][]
}

export interface ChatAssistant {
  id: string
  name: string
  dataset_ids: string[]
  create_time: number
  update_time: number
}

/* ========== 健康检查 ========== */

export async function getHealthStatus(): Promise<{ healthy: boolean; baseUrl: string }> {
  const res = await request.get('/knowledge/health')
  return res.data
}

export async function getUiUrl(): Promise<string> {
  const res = await request.get('/knowledge/ui-url')
  return res.data.url
}

/* ========== Dataset ========== */

export async function getDatasets(params?: { page?: number; page_size?: number; name?: string }): Promise<Dataset[]> {
  const res = await request.get('/knowledge/datasets', { params })
  return res.data.data || []
}

export async function createDataset(data: {
  name: string
  description?: string
  chunk_method?: string
  parser_config?: Record<string, unknown>
}): Promise<Dataset> {
  const res = await request.post('/knowledge/datasets', data)
  return res.data.data
}

export async function updateDataset(id: string, data: {
  name?: string
  description?: string
  chunk_method?: string
}): Promise<void> {
  await request.put(`/knowledge/datasets/${id}`, data)
}

export async function deleteDatasets(ids: string[]): Promise<void> {
  await request.delete('/knowledge/datasets', { data: { ids } })
}

/* ========== Document ========== */

export async function getDocuments(
  datasetId: string,
  params?: { page?: number; page_size?: number; name?: string }
): Promise<{ total: number; docs: Document[] }> {
  const res = await request.get(`/knowledge/datasets/${datasetId}/documents`, { params })
  return res.data.data || { total: 0, docs: [] }
}

export async function uploadDocument(datasetId: string, file: File): Promise<Document[]> {
  const form = new FormData()
  form.append('file', file)
  const res = await request.post(`/knowledge/datasets/${datasetId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data || []
}

export async function deleteDocuments(datasetId: string, ids: string[]): Promise<void> {
  await request.delete(`/knowledge/datasets/${datasetId}/documents`, { data: { ids } })
}

export async function triggerParsing(datasetId: string, documentIds: string[]): Promise<void> {
  await request.post(`/knowledge/datasets/${datasetId}/documents/parse`, { document_ids: documentIds })
}

export async function cancelParsing(datasetId: string, documentIds: string[]): Promise<void> {
  await request.post(`/knowledge/datasets/${datasetId}/documents/parse/cancel`, { document_ids: documentIds })
}

/* ========== Chunk ========== */

export async function getChunks(
  datasetId: string,
  documentId: string,
  params?: { page?: number; page_size?: number; keywords?: string }
): Promise<{ total: number; chunks: Chunk[] }> {
  const res = await request.get(`/knowledge/datasets/${datasetId}/documents/${documentId}/chunks`, { params })
  return res.data.data || { total: 0, chunks: [] }
}

/* ========== Retrieval ========== */

export async function retrievalTest(data: {
  question: string
  dataset_ids: string[]
  top_k?: number
  similarity_threshold?: number
  keyword?: boolean
}): Promise<{ chunks: Chunk[]; total: number }> {
  const res = await request.post('/knowledge/retrieval', data)
  return res.data.data || { chunks: [], total: 0 }
}

/* ========== Document Download ========== */

export function getDocumentDownloadUrl(datasetId: string, documentId: string): string {
  return `/api/knowledge/datasets/${datasetId}/documents/${documentId}/download`
}

/* ========== Chat Assistant ========== */

export async function getChatAssistants(): Promise<ChatAssistant[]> {
  const res = await request.get('/knowledge/chats')
  return res.data.data || []
}

export async function createChatAssistant(data: {
  name: string
  dataset_ids: string[]
}): Promise<ChatAssistant> {
  const res = await request.post('/knowledge/chats', data)
  return res.data.data
}

export async function deleteChatAssistants(ids: string[]): Promise<void> {
  await request.delete('/knowledge/chats', { data: { ids } })
}
