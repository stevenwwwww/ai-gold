/**
 * 知识库服务 - 预留接口
 * 二期实现：关键词检索、原文调取、片段定位、文档溯源
 * 与 PRD 私有知识库模块对齐
 */

export interface SearchResult {
  id: string
  title: string
  snippet: string
  relevance: number
  source?: string
  uploadTime?: number
}

/**
 * 关键词检索（预留）
 */
export async function search(keyword: string): Promise<SearchResult[]> {
  // TODO: 二期实现 RAG/向量检索
  return []
}

/**
 * 获取文档原文（预留）
 */
export async function getDocument(id: string): Promise<{ url: string; type: 'pdf' | 'word' } | null> {
  // TODO: 二期实现 PDF/Word 在线预览
  return null
}

/**
 * 定位到文档片段（预留）
 */
export async function locateSnippet(docId: string, keyword: string): Promise<string | null> {
  // TODO: 二期实现
  return null
}
