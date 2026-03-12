#!/usr/bin/env node
/**
 * 医学文献爬虫 - 24 小时常驻，定时从 PubMed/PMC 抓取并导入 RAGFlow
 *
 * 运行：yarn crawler 或 tsx scripts/crawler/index.ts
 * 环境变量：见 config.ts，需配置 RAGFLOW_API_KEY、NCBI_EMAIL
 */
import 'dotenv/config'

import { crawlerConfig } from './config'
import { fetchPubMedBatch } from './sources/pubmed'
import { fetchPmcFullText } from './sources/pmc'
import { pubmedToContent, toFileName } from './transformers/toRagflow'
import { uploadPaper } from './uploader'
import { filterNotImported, markImported, closeDb } from './state'
async function runOnce(): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0

  if (!crawlerConfig.ragflowApiKey) {
    console.warn('[Crawler] 未配置 RAGFLOW_API_KEY，跳过上传')
    return { imported: 0, skipped: 0 }
  }

  for (const query of crawlerConfig.defaultQueries) {
    if (!query) continue
    console.log(`[Crawler] 检索: ${query}`)
    try {
      const articles = await fetchPubMedBatch(
        query,
        crawlerConfig.batchSize,
        crawlerConfig.ncbiEmail,
        crawlerConfig.ncbiDelayMs
      )
      console.log(`[Crawler] 获取 ${articles.length} 篇`)

      for (const art of articles) {
        const id = art.pmcId ? art.pmcId : art.pmid
        const source: 'pmid' | 'pmc' = art.pmcId ? 'pmc' : 'pmid'
        const existing = filterNotImported(crawlerConfig.statePath, [id], source)
        if (existing.length === 0) {
          skipped++
          continue
        }

        const content = pubmedToContent(art)
        const fileName = toFileName(art)
        try {
          await uploadPaper(content, fileName)
          markImported(crawlerConfig.statePath, id, source)
          imported++
          console.log(`[Crawler] 已导入: ${art.title.slice(0, 50)}...`)
        } catch (e) {
          console.error('[Crawler] 上传失败:', fileName, e)
        }
        await new Promise((r) => setTimeout(r, crawlerConfig.ncbiDelayMs))
      }
    } catch (e) {
      console.error('[Crawler] 检索失败:', query, e)
    }
  }

  return { imported, skipped }
}

async function main(): Promise<void> {
  console.log('[Crawler] 启动医学文献爬虫')
  console.log('[Crawler] 数据源: PubMed/PMC')
  console.log('[Crawler] 知识库:', crawlerConfig.ragflowDatasetId || '(自动创建)')
  console.log('[Crawler] 检索词:', crawlerConfig.defaultQueries.join(', '))
  console.log('[Crawler] 轮次间隔:', crawlerConfig.intervalMs / 1000 / 60, '分钟')

  const runForever = process.argv.includes('--daemon') || process.env.CRAWLER_DAEMON === '1'

  if (runForever) {
    const loop = async () => {
      try {
        const { imported, skipped } = await runOnce()
        console.log(`[Crawler] 本轮完成: 导入 ${imported} 篇, 跳过 ${skipped} 篇`)
      } catch (e) {
        console.error('[Crawler] 异常:', e)
      }
      setTimeout(loop, crawlerConfig.intervalMs)
    }
    await loop()
  } else {
    const { imported, skipped } = await runOnce()
    console.log(`[Crawler] 完成: 导入 ${imported} 篇, 跳过 ${skipped} 篇`)
    closeDb()
    process.exit(0)
  }
}

main().catch((e) => {
  console.error('[Crawler] 启动失败:', e)
  closeDb()
  process.exit(1)
})
