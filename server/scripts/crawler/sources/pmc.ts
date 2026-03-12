/**
 * PMC (PubMed Central) 全文/PDF 获取
 * 有 PMC ID 的文章可获取开放获取全文或 PDF
 */
const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

export interface PmcFetchResult {
  pmcId: string
  content: Buffer
  format: 'text' | 'pdf'
  fileName: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 获取 PMC 全文（XML 格式，解析为纯文本）
 * 仅 Open Access 文章可获取全文
 */
export async function fetchPmcFullText(
  pmcId: string,
  delayMs: number
): Promise<{ content: string; title: string; year: string } | null> {
  const id = pmcId.startsWith('PMC') ? pmcId.replace(/^PMC/i, '') : pmcId
  await sleep(delayMs)
  const params = new URLSearchParams({
    db: 'pmc',
    id: `PMC${id}`,
    retmode: 'xml',
  })
  const url = `${NCBI_BASE}/efetch.fcgi?${params}`
  const res = await fetch(url)
  if (!res.ok) return null
  const xml = await res.text()
  return extractPmcText(xml, id)
}

/**
 * 解析 PMC XML 提取正文和元数据
 */
function extractPmcText(xml: string, pmcId: string): { content: string; title: string; year: string } | null {
  try {
    const titleMatch = xml.match(/<article-title[^>]*>([\s\S]*?)<\/article-title>/i)
    const title = titleMatch ? stripXml(titleMatch[1]) : `PMC${pmcId}`

    const yearMatch = xml.match(/<pub-date[^>]*>[\s\S]*?<year[^>]*>(\d{4})<\/year>/i)
    const year = yearMatch ? yearMatch[1] : ''

    const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (!bodyMatch) return null

    const body = stripXml(bodyMatch[1])
    const cleanBody = body
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    if (cleanBody.length < 100) return null

    const fullContent = `Title: ${title}\nYear: ${year}\nPMC ID: PMC${pmcId}\n\n${cleanBody}`
    return { content: fullContent, title, year }
  } catch {
    return null
  }
}

function stripXml(str: string): string {
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 获取 PMC PDF 下载链接
 * Open Access 文章可直接下载
 */
export function getPmcPdfUrl(pmcId: string): string {
  const id = pmcId.startsWith('PMC') ? pmcId : `PMC${pmcId}`
  return `${NCBI_BASE}/efetch.fcgi?db=pmc&id=${id}&rettype=pdf`
}

/**
 * 下载 PMC PDF（若为 Open Access）
 */
export async function fetchPmcPdf(pmcId: string, delayMs: number): Promise<Buffer | null> {
  const url = getPmcPdfUrl(pmcId)
  await sleep(delayMs)
  const res = await fetch(url)
  if (!res.ok) return null
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('pdf')) return null
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
