/**
 * 知识库检索页面
 *
 * 完全基于 RAGFlow retrieval API，无额外依赖
 *
 * 功能：
 *   1. 搜索框 → 调用 RAGFlow retrieval API
 *   2. 展示检索结果（片段内容 + 来源文档 + 相关度 + 页码）
 *   3. 点击「查看原文」→ 通过 RAGFlow document download API 用 iframe 打开 PDF，带页码定位
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Input, Button, Space, Tag, Typography, Empty, Spin,
  Select, message, Modal, Tooltip, Row, Col, List,
} from 'antd'
import {
  SearchOutlined, FileTextOutlined, EnvironmentOutlined,
} from '@ant-design/icons'
import * as knowledgeApi from '../../api/knowledge'

const { Text, Title, Paragraph } = Typography

const KnowledgeSearchPage: React.FC = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<knowledgeApi.Chunk[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const [datasets, setDatasets] = useState<knowledgeApi.Dataset[]>([])
  const [selectedDsIds, setSelectedDsIds] = useState<string[]>([])
  const [datasetsLoaded, setDatasetsLoaded] = useState(false)

  const [pdfOpen, setPdfOpen] = useState(false)
  const [pdfIframeSrc, setPdfIframeSrc] = useState('')
  const [pdfTitle, setPdfTitle] = useState('')

  const loadDatasets = useCallback(async () => {
    if (datasetsLoaded) return
    try {
      const data = await knowledgeApi.getDatasets()
      setDatasets(data)
      if (data.length > 0) setSelectedDsIds(data.map((d) => d.id))
      setDatasetsLoaded(true)
    } catch (e: any) {
      message.error(e.message || '加载知识库列表失败')
    }
  }, [datasetsLoaded])

  useEffect(() => { loadDatasets() }, [loadDatasets])

  const handleSearch = async () => {
    const q = query.trim()
    if (!q) { message.warning('请输入检索内容'); return }
    if (selectedDsIds.length === 0) { message.warning('请选择至少一个知识库'); return }

    setLoading(true)
    setSearched(true)
    try {
      const { chunks } = await knowledgeApi.retrievalTest({
        question: q,
        dataset_ids: selectedDsIds,
        top_k: 15,
        similarity_threshold: 0.1,
      })
      setResults(chunks)
    } catch (e: any) {
      message.error(e.message || '检索失败')
    } finally {
      setLoading(false)
    }
  }

  const getPageNumber = (positions: number[][]): number | null => {
    if (!positions || positions.length === 0) return null
    const p = positions[0][0]
    return p >= 1 ? p : p + 1
  }

  const handleOpenPdf = (chunk: knowledgeApi.Chunk) => {
    if (!chunk.dataset_id || !chunk.document_id) {
      message.error('缺少文档信息'); return
    }
    const page = getPageNumber(chunk.positions)
    let url = knowledgeApi.getDocumentDownloadUrl(chunk.dataset_id, chunk.document_id)
    if (page) url += `#page=${page}`
    setPdfIframeSrc(url)
    setPdfTitle(chunk.document_name || '文档')
    setPdfOpen(true)
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        <SearchOutlined /> 知识库检索
      </Title>

      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input.Search
            size="large"
            placeholder="输入检索内容，如：公司盈利能力分析、行业竞争格局..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onSearch={handleSearch}
            enterButton={<Button type="primary" icon={<SearchOutlined />} loading={loading}>检索</Button>}
            allowClear
          />
          <Space align="center" wrap>
            <Text type="secondary">选择知识库：</Text>
            <Select
              mode="multiple"
              placeholder="选择知识库（可多选）"
              value={selectedDsIds}
              onChange={setSelectedDsIds}
              style={{ minWidth: 400 }}
              maxTagCount={3}
              options={datasets.map((ds) => ({
                label: `${ds.name} (${ds.document_count} 文档)`,
                value: ds.id,
              }))}
            />
            {datasets.length > 0 && (
              <Button size="small" type="link"
                onClick={() => setSelectedDsIds(
                  selectedDsIds.length === datasets.length ? [] : datasets.map((d) => d.id)
                )}>
                {selectedDsIds.length === datasets.length ? '取消全选' : '全选'}
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <Empty description="未找到相关内容，请尝试调整检索词" />
      )}

      {!loading && results.length > 0 && (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Text strong>找到 {results.length} 个相关片段</Text>
            <Text type="secondary">点击「查看原文」打开 PDF 并定位到出处</Text>
          </div>
          <List
            dataSource={results}
            renderItem={(chunk, idx) => {
              const page = getPageNumber(chunk.positions)
              return (
                <Card size="small" style={{ marginBottom: 12 }} hoverable
                  title={
                    <Space>
                      <Tag color="blue">#{idx + 1}</Tag>
                      <FileTextOutlined />
                      <Text ellipsis style={{ maxWidth: 300 }}>{chunk.document_name}</Text>
                      <Tag color="green">相关度 {(chunk.similarity * 100).toFixed(1)}%</Tag>
                      {page && <Tag color="orange" icon={<EnvironmentOutlined />}>第 {page} 页</Tag>}
                    </Space>
                  }
                  extra={
                    <Tooltip title="打开 PDF 定位到原文出处">
                      <Button type="primary" size="small" icon={<FileTextOutlined />}
                        onClick={() => handleOpenPdf(chunk)}>
                        查看原文
                      </Button>
                    </Tooltip>
                  }>
                  <Paragraph style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0, maxHeight: 200, overflow: 'auto' }}>
                    {chunk.content}
                  </Paragraph>
                </Card>
              )
            }}
          />
        </>
      )}

      <Modal
        open={pdfOpen}
        title={<><FileTextOutlined /> {pdfTitle}</>}
        footer={null}
        onCancel={() => { setPdfOpen(false); setPdfIframeSrc('') }}
        width="85vw"
        styles={{ body: { height: '80vh', padding: 0 } }}
        destroyOnClose
      >
        {pdfIframeSrc && (
          <iframe src={pdfIframeSrc} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Viewer" />
        )}
      </Modal>
    </div>
  )
}

export default KnowledgeSearchPage
