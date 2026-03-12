/**
 * 上传文档到 RAGFlow 知识库
 */
import {
  uploadDocument,
  triggerParsing,
  createDataset,
  listDatasets,
  type RagflowDocument,
} from '../../src/services/ragflowService'
import { crawlerConfig } from './config'

async function ensureDataset(): Promise<string> {
  const id = crawlerConfig.ragflowDatasetId
  if (id) return id

  const datasets = await listDatasets({ page: 1, page_size: 20 })
  const medical = datasets.find((d) => d.name.toLowerCase().includes('medical') || d.name.includes('医生'))
  if (medical) return medical.id

  const created = await createDataset('medical_literature', {
    description: '医生助手医学文献知识库 - 来自 PubMed/PMC',
  })
  console.log('[Crawler] 已创建知识库:', created.name, created.id)
  return created.id
}

/**
 * 上传单篇文献（文本格式）
 */
export async function uploadPaper(
  content: string,
  fileName: string
): Promise<RagflowDocument[]> {
  const datasetId = await ensureDataset()
  const buf = Buffer.from(content, 'utf-8')
  const docs = await uploadDocument(datasetId, buf, fileName, 'text/plain')
  if (docs.length > 0) {
    await triggerParsing(datasetId, docs.map((d) => d.id))
  }
  return docs
}

/**
 * 上传 PDF 文档
 */
export async function uploadPdf(pdfBuffer: Buffer, fileName: string): Promise<RagflowDocument[]> {
  const datasetId = await ensureDataset()
  const docs = await uploadDocument(datasetId, pdfBuffer, fileName, 'application/pdf')
  if (docs.length > 0) {
    await triggerParsing(datasetId, docs.map((d) => d.id))
  }
  return docs
}
