/**
 * 统一转换为 RAGFlow 文档格式
 * 文档命名：Title (Year) [PMC123456].txt 便于溯源展示
 */
import type { PubMedArticle } from '../sources/pubmed'

export interface RagflowDocumentInput {
  title: string
  year: string
  pmcId: string | null
  pmid: string
  content: string
  format: 'text'
}

/**
 * 从 PubMed 摘要生成 RAGFlow 文本内容
 */
export function pubmedToContent(art: PubMedArticle): string {
  return [
    `Title: ${art.title}`,
    `Authors: ${art.authors}`,
    `Journal: ${art.journal}`,
    `Volume: ${art.volume}, Issue: ${art.issue}, Pages: ${art.pages}`,
    `DOI: ${art.doi || '-'}`,
    `PMID: ${art.pmid}`,
    art.pmcId ? `PMC ID: PMC${art.pmcId}` : '',
    `Year: ${art.year}`,
    '',
    'Abstract:',
    art.abstract,
  ].filter(Boolean).join('\n')
}

/**
 * 生成 RAGFlow 文档文件名（供溯源）
 * 格式：Title (Year) [PMC123456].txt 或 Title (Year) [PMID123].txt
 */
export function toFileName(art: { title: string; year: string; pmcId: string | null; pmid: string }): string {
  const safeTitle = art.title.replace(/[/\\?*:|"]/g, '_').slice(0, 80)
  const ref = art.pmcId ? `PMC${art.pmcId}` : `PMID${art.pmid}`
  return `${safeTitle} (${art.year}) [${ref}].txt`
}
