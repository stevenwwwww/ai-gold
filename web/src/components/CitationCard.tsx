/**
 * 引用文献卡片 — 显示来源，支持「查看原文」跳转 PMC/PMID
 * documentName 格式：Title (Year) [PMC123456].txt 或 Title (Year) [PMID123].txt
 */
import { Card, Button } from 'antd'
import { LinkOutlined } from '@ant-design/icons'

export interface CitationCardProps {
  documentName: string
  content: string
  similarity: number
}

/** 从 documentName 解析 PMC ID 或 PMID，生成原文链接 */
function parseDocumentRef(name: string): { url: string; label: string } | null {
  const pmcMatch = name.match(/\[PMC(\d+)\]/i)
  if (pmcMatch) {
    return {
      url: `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcMatch[1]}/`,
      label: `查看原文 (PMC${pmcMatch[1]})`,
    }
  }
  const pmidMatch = name.match(/\[PMID(\d+)\]/i)
  if (pmidMatch) {
    return {
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmidMatch[1]}/`,
      label: `查看原文 (PMID${pmidMatch[1]})`,
    }
  }
  return null
}

export default function CitationCard({ documentName, content, similarity }: CitationCardProps) {
  const ref = parseDocumentRef(documentName)

  return (
    <Card size="small" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>{documentName}</span>
        <span style={{ fontSize: 11, color: '#1677ff' }}>相关度 {(similarity * 100).toFixed(0)}%</span>
      </div>
      <p style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.5, color: '#333' }}>
        {content.length > 200 ? `${content.slice(0, 200)}...` : content}
      </p>
      {ref && (
        <Button
          type="link"
          size="small"
          icon={<LinkOutlined />}
          href={ref.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: 0, minHeight: 24 }}
        >
          {ref.label}
        </Button>
      )}
    </Card>
  )
}
