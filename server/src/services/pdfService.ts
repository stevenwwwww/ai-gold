/**
 * PDF 解析服务 - 使用 pdf-parse 提取文本
 * 预留：表格识别、OCR 接口
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>
import { config } from '../config'

export interface ParseResult {
  text: string
  pages: number
  tables?: string[] // 占位，二期用 LLM 辅助解析
}

export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const maxBytes = config.maxPdfSizeMb * 1024 * 1024
  if (buffer.length > maxBytes) {
    throw new Error(`PDF 超过 ${config.maxPdfSizeMb}MB 限制`)
  }

  const data = await pdf(buffer)
  return {
    text: data.text || '',
    pages: data.numpages || 0,
    tables: [], // 占位
  }
}
