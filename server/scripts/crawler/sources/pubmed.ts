/**
 * PubMed / NCBI E-utilities 封装
 * 使用 esearch + efetch 获取医学文献摘要与元数据
 */
import { XMLParser } from 'fast-xml-parser'

const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

export interface PubMedArticle {
  pmid: string
  pmcId: string | null
  title: string
  abstract: string
  authors: string
  journal: string
  volume: string
  issue: string
  pages: string
  doi: string | null
  year: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * esearch - 按关键词搜索，返回 PMID 列表
 */
export async function searchPubMed(
  query: string,
  options: { retmax?: number; mindate?: string; maxdate?: string; email?: string } = {}
): Promise<string[]> {
  const params = new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmax: String(options.retmax ?? 50),
    retmode: 'json',
    ...(options.email && { email: options.email }),
    ...(options.mindate && { mindate: options.mindate }),
    ...(options.maxdate && { maxdate: options.maxdate }),
  })
  const url = `${NCBI_BASE}/esearch.fcgi?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`PubMed esearch ${res.status}`)
  const data = await res.json() as { esearchresult?: { idlist?: string[] } }
  return data.esearchresult?.idlist ?? []
}

/**
 * efetch - 按 PMID 获取详细信息（XML）
 */
export async function fetchPubMedDetails(pmids: string[], email?: string): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return []
  const params = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'xml',
    ...(email && { email }),
  })
  const url = `${NCBI_BASE}/efetch.fcgi?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`PubMed efetch ${res.status}`)
  const xml = await res.text()
  return parsePubMedXml(xml)
}

function parsePubMedXml(xml: string): PubMedArticle[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
  })
  const doc = parser.parse(xml)
  const pubmedSet = doc.PubmedArticleSet
  if (!pubmedSet) return []

  const articles = Array.isArray(pubmedSet.PubmedArticle)
    ? pubmedSet.PubmedArticle
    : pubmedSet.PubmedArticle
      ? [pubmedSet.PubmedArticle]
      : []

  return articles.map((art: Record<string, unknown>) => parseOneArticle(art))
}

function safeText(obj: unknown): string {
  if (obj == null) return ''
  if (typeof obj === 'string') return obj.trim()
  if (typeof obj === 'object') {
    const o = obj as Record<string, unknown>
    const v = o['#text'] ?? o['#']
    if (v != null) return String(v).trim()
  }
  return ''
}

function safeFind(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

function parseOneArticle(art: Record<string, unknown>): PubMedArticle {
  const medline = art.MedlineCitation as Record<string, unknown> | undefined
  const article = medline?.Article as Record<string, unknown> | undefined
  const pmidNode = medline?.PMID
  const pmid = safeText(pmidNode) || ''

  const title = safeText(article?.ArticleTitle) || 'No title'

  const abstractNode = article?.Abstract
  let abstract = ''
  if (abstractNode) {
    const textNodes = (abstractNode as Record<string, unknown>).AbstractText
    if (Array.isArray(textNodes)) {
      abstract = textNodes.map((t: unknown) => safeText(t)).filter(Boolean).join('\n')
    } else if (textNodes) {
      abstract = safeText(textNodes)
    }
  }
  if (!abstract) abstract = 'No abstract available'

  const journal = article?.Journal as Record<string, unknown> | undefined
  const journalTitle = journal?.Title
  const journalIssue = journal?.JournalIssue as Record<string, unknown> | undefined
  const vol = journalIssue?.Volume
  const issue = journalIssue?.Issue
  const pagination = article?.Pagination as Record<string, unknown> | undefined
  const pages = pagination?.MedlinePgn

  let authors = 'Unknown Authors'
  const authorList = article?.AuthorList as Record<string, unknown> | undefined
  if (authorList) {
    const raw = authorList.Author
    const list = Array.isArray(raw) ? raw : raw ? [raw] : []
    const names = list.map((a: Record<string, unknown>) => {
      const last = safeText(a.LastName)
      const fore = safeText(a.ForeName)
      return `${fore} ${last}`.trim()
    }).filter(Boolean)
    if (names.length) authors = names.join(', ')
  }

  let doi: string | null = null
  let pmcId: string | null = null
  const articleIds = (article as Record<string, unknown>)?.ArticleIdList?.ArticleId
  if (articleIds) {
    const ids = Array.isArray(articleIds) ? articleIds : [articleIds]
    for (const id of ids) {
      const t = id as Record<string, unknown>
      const idType = t['@_IdType'] ?? t['IdType']
      const val = safeText(t['#text'] ?? t['#']) || ''
      if (idType === 'doi') doi = val || null
      if (idType === 'pmc') pmcId = val.replace(/^PMC/i, '') || null
    }
  }

  let year = ''
  const pubDate = journalIssue?.PubDate
  if (pubDate) {
    const d = pubDate as Record<string, unknown>
    year = String(d.Year ?? d.MedlineDate ?? '').slice(0, 4)
  }

  return {
    pmid,
    pmcId,
    title,
    abstract,
    authors,
    journal: safeText(journalTitle) || 'Unknown Journal',
    volume: safeText(vol) || '-',
    issue: safeText(issue) || '-',
    pages: safeText(pages) || '-',
    doi,
    year,
  }
}

/**
 * 单轮抓取：搜索 + 获取详情
 */
export async function fetchPubMedBatch(
  query: string,
  limit: number,
  email: string,
  delayMs: number
): Promise<PubMedArticle[]> {
  await sleep(delayMs)
  const pmids = await searchPubMed(query, { retmax: limit, email })
  if (pmids.length === 0) return []
  await sleep(delayMs)
  return fetchPubMedDetails(pmids, email)
}
