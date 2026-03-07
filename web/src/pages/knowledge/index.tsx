/**
 * 知识库管理页面
 *
 * 功能：
 *   1. 知识库列表（Dataset CRUD）
 *   2. 文档管理（上传 / 解析 / 删除）
 *   3. 分块浏览
 *   4. 检索测试
 *   5. RAGFlow UI iframe 嵌入
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Space, Modal, Form, Input, Select,
  Upload, message, Tag, Tabs, Progress, Descriptions, Typography,
  Popconfirm, Empty, Spin, Badge, Tooltip, Row, Col, Statistic,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, UploadOutlined, SearchOutlined,
  ReloadOutlined, DatabaseOutlined, FileTextOutlined, LinkOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  EyeOutlined, InboxOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile, UploadProps } from 'antd'
import * as knowledgeApi from '../../api/knowledge'

const { TextArea } = Input
const { Text } = Typography
const { Dragger } = Upload

type ViewMode = 'datasets' | 'documents' | 'chunks' | 'retrieval' | 'ragflow-ui'

const KnowledgePage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('datasets')
  const [loading, setLoading] = useState(false)
  const [ragflowHealthy, setRagflowHealthy] = useState<boolean | null>(null)
  const [ragflowUiUrl, setRagflowUiUrl] = useState('')

  // Dataset
  const [datasets, setDatasets] = useState<knowledgeApi.Dataset[]>([])
  const [createDsOpen, setCreateDsOpen] = useState(false)
  const [dsForm] = Form.useForm()

  // Documents
  const [selectedDataset, setSelectedDataset] = useState<knowledgeApi.Dataset | null>(null)
  const [documents, setDocuments] = useState<knowledgeApi.Document[]>([])
  const [docTotal, setDocTotal] = useState(0)

  // Chunks
  const [selectedDoc, setSelectedDoc] = useState<knowledgeApi.Document | null>(null)
  const [chunks, setChunks] = useState<knowledgeApi.Chunk[]>([])
  const [chunkTotal, setChunkTotal] = useState(0)

  // Retrieval
  const [retrievalQuestion, setRetrievalQuestion] = useState('')
  const [retrievalResults, setRetrievalResults] = useState<knowledgeApi.Chunk[]>([])
  const [retrievalLoading, setRetrievalLoading] = useState(false)
  const [selectedDsIds, setSelectedDsIds] = useState<string[]>([])

  // Chat Assistants
  const [chatAssistants, setChatAssistants] = useState<knowledgeApi.ChatAssistant[]>([])

  const checkHealth = useCallback(async () => {
    try {
      const { healthy, baseUrl } = await knowledgeApi.getHealthStatus()
      setRagflowHealthy(healthy)
      if (healthy) {
        const uiUrl = await knowledgeApi.getUiUrl()
        setRagflowUiUrl(uiUrl)
      }
      console.log(`[Knowledge] RAGFlow ${healthy ? '在线' : '离线'} (${baseUrl})`)
    } catch {
      setRagflowHealthy(false)
    }
  }, [])

  const loadDatasets = useCallback(async () => {
    setLoading(true)
    try {
      const data = await knowledgeApi.getDatasets()
      setDatasets(data)
    } catch (e: any) {
      message.error(e.message || '加载知识库失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkHealth()
    loadDatasets()
  }, [checkHealth, loadDatasets])

  const loadDocuments = useCallback(async (dsId: string) => {
    setLoading(true)
    try {
      const { total, docs } = await knowledgeApi.getDocuments(dsId)
      setDocuments(docs)
      setDocTotal(total)
    } catch (e: any) {
      message.error(e.message || '加载文档失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadChunks = useCallback(async (dsId: string, docId: string) => {
    setLoading(true)
    try {
      const { total, chunks: c } = await knowledgeApi.getChunks(dsId, docId)
      setChunks(c)
      setChunkTotal(total)
    } catch (e: any) {
      message.error(e.message || '加载分块失败')
    } finally {
      setLoading(false)
    }
  }, [])

  /* ===== Dataset CRUD ===== */

  const handleCreateDataset = async (values: any) => {
    try {
      await knowledgeApi.createDataset(values)
      message.success('知识库创建成功')
      setCreateDsOpen(false)
      dsForm.resetFields()
      loadDatasets()
    } catch (e: any) {
      message.error(e.message || '创建失败')
    }
  }

  const handleDeleteDataset = async (ids: string[]) => {
    try {
      await knowledgeApi.deleteDatasets(ids)
      message.success('已删除')
      loadDatasets()
    } catch (e: any) {
      message.error(e.message || '删除失败')
    }
  }

  // Upload file list state for antd Upload component
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')

  const MAX_UPLOAD_FILES = 5

  const handleUploadFile = async (datasetId: string, file: File) => {
    try {
      await knowledgeApi.uploadDocument(datasetId, file)
      message.success(`${file.name} 上传成功，已触发解析`)
      loadDocuments(datasetId)
    } catch (e: any) {
      message.error(e.message || '上传失败')
      throw e
    }
  }

  const handlePreviewFile = (file: UploadFile) => {
    if (file.originFileObj) {
      const url = URL.createObjectURL(file.originFileObj)
      setPreviewUrl(url)
      setPreviewTitle(file.name)
      setPreviewOpen(true)
    }
  }

  const handleDeleteDoc = async (docIds: string[]) => {
    if (!selectedDataset) return
    try {
      await knowledgeApi.deleteDocuments(selectedDataset.id, docIds)
      message.success('已删除')
      loadDocuments(selectedDataset.id)
    } catch (e: any) {
      message.error(e.message || '删除失败')
    }
  }

  const handleRetrieval = async () => {
    if (!retrievalQuestion.trim()) return
    if (selectedDsIds.length === 0) {
      message.warning('请选择至少一个知识库')
      return
    }
    setRetrievalLoading(true)
    try {
      const { chunks: result } = await knowledgeApi.retrievalTest({
        question: retrievalQuestion,
        dataset_ids: selectedDsIds,
        top_k: 10,
      })
      setRetrievalResults(result)
    } catch (e: any) {
      message.error(e.message || '检索失败')
    } finally {
      setRetrievalLoading(false)
    }
  }

  /* ===== 表格列定义 ===== */

  const datasetColumns: ColumnsType<knowledgeApi.Dataset> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '分块方式', dataIndex: 'chunk_method', key: 'chunk_method', width: 120,
      render: (v: string) => <Tag>{v || 'naive'}</Tag>,
    },
    {
      title: '文档数', dataIndex: 'document_count', key: 'document_count', width: 90,
      render: (v: number) => <Badge count={v} showZero style={{ backgroundColor: '#1890ff' }} />,
    },
    {
      title: '分块数', dataIndex: 'chunk_count', key: 'chunk_count', width: 90,
      render: (v: number) => v?.toLocaleString() || 0,
    },
    {
      title: 'Token 数', dataIndex: 'token_num', key: 'token_num', width: 120,
      render: (v: number) => v?.toLocaleString() || 0,
    },
    {
      title: '操作', key: 'action', width: 200,
      render: (_: unknown, record: knowledgeApi.Dataset) => (
        <Space>
          <Button size="small" icon={<FileTextOutlined />}
            onClick={() => {
              setSelectedDataset(record)
              loadDocuments(record.id)
              setViewMode('documents')
            }}>
            文档
          </Button>
          <Popconfirm title="确认删除此知识库？" onConfirm={() => handleDeleteDataset([record.id])}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const docStatusTag = (doc: knowledgeApi.Document) => {
    if (doc.run === '1') return <Tag icon={<SyncOutlined spin />} color="processing">解析中</Tag>
    if (doc.run === '2' && doc.progress >= 1) return <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag>
    if (doc.run === '3') return <Tag icon={<CloseCircleOutlined />} color="error">已取消</Tag>
    if (doc.progress_msg?.toLowerCase().includes('error')) return <Tag color="error">出错</Tag>
    return <Tag>待解析</Tag>
  }

  const documentColumns: ColumnsType<knowledgeApi.Document> = [
    { title: '文件名', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: '大小', dataIndex: 'size', key: 'size', width: 100,
      render: (v: number) => `${(v / 1024).toFixed(0)} KB`,
    },
    {
      title: '状态', key: 'status', width: 120,
      render: (_: unknown, r: knowledgeApi.Document) => docStatusTag(r),
    },
    {
      title: '解析进度', key: 'progress', width: 160,
      render: (_: unknown, r: knowledgeApi.Document) => (
        <Progress percent={Math.round((r.progress || 0) * 100)} size="small"
          status={r.run === '1' ? 'active' : undefined} />
      ),
    },
    {
      title: '分块数', dataIndex: 'chunk_count', key: 'chunk_count', width: 90,
      render: (v: number) => v?.toLocaleString() || 0,
    },
    {
      title: '操作', key: 'action', width: 180,
      render: (_: unknown, record: knowledgeApi.Document) => (
        <Space>
          {record.chunk_count > 0 && (
            <Button size="small"
              onClick={() => {
                setSelectedDoc(record)
                if (selectedDataset) loadChunks(selectedDataset.id, record.id)
                setViewMode('chunks')
              }}>
              分块
            </Button>
          )}
          <Popconfirm title="确认删除此文档？" onConfirm={() => handleDeleteDoc([record.id])}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const chunkColumns: ColumnsType<knowledgeApi.Chunk> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 200, ellipsis: true },
    {
      title: '内容', dataIndex: 'content', key: 'content',
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v?.slice(0, 200)}{v?.length > 200 ? '...' : ''}</Text>,
    },
  ]

  /* ===== Tab 内容 ===== */

  const renderDatasets = () => (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateDsOpen(true)}>
            新建知识库
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadDatasets}>刷新</Button>
        </Space>
        <Space>
          {ragflowHealthy === true && (
            <Tag icon={<CheckCircleOutlined />} color="success">RAGFlow 在线</Tag>
          )}
          {ragflowHealthy === false && (
            <Tooltip title="请确保 RAGFlow Docker 已启动">
              <Tag icon={<CloseCircleOutlined />} color="error">RAGFlow 离线</Tag>
            </Tooltip>
          )}
        </Space>
      </div>
      <Table columns={datasetColumns} dataSource={datasets} rowKey="id" loading={loading} pagination={false} />
    </div>
  )

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: '.pdf',
    fileList: uploadFileList,
    maxCount: MAX_UPLOAD_FILES,
    beforeUpload: (file, fileList) => {
      if (uploadFileList.length + fileList.length > MAX_UPLOAD_FILES) {
        message.warning(`最多上传 ${MAX_UPLOAD_FILES} 个文件`)
        return Upload.LIST_IGNORE
      }
      if (file.type !== 'application/pdf') {
        message.error(`${file.name} 不是 PDF 文件`)
        return Upload.LIST_IGNORE
      }
      return true
    },
    customRequest: async ({ file, onProgress, onSuccess, onError }) => {
      if (!selectedDataset) return
      try {
        onProgress?.({ percent: 30 })
        await handleUploadFile(selectedDataset.id, file as File)
        onProgress?.({ percent: 100 })
        onSuccess?.('ok')
      } catch (e: any) {
        onError?.(e)
      }
    },
    onChange: ({ fileList }) => {
      setUploadFileList(fileList)
    },
    onPreview: handlePreviewFile,
    onRemove: (file) => {
      setUploadFileList((prev) => prev.filter((f) => f.uid !== file.uid))
      return true
    },
    showUploadList: {
      showPreviewIcon: true,
      showRemoveIcon: true,
      showDownloadIcon: false,
    },
    itemRender: (originNode, file) => {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>{originNode}</div>
          {file.status === 'done' && (
            <Tooltip title="预览">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handlePreviewFile(file)}
              />
            </Tooltip>
          )}
        </div>
      )
    },
  }

  const renderDocuments = () => (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Button onClick={() => { setViewMode('datasets'); setSelectedDataset(null) }}>← 返回知识库列表</Button>
          <Text strong>知识库: {selectedDataset?.name}</Text>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />}
            onClick={() => selectedDataset && loadDocuments(selectedDataset.id)}>
            刷新
          </Button>
        </Space>
      </div>

      {/* antd Upload 区域：拖拽上传 + 进度条 + 删除 + 预览，最多 5 个 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Dragger {...uploadProps} style={{ padding: '12px 0' }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽 PDF 文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持批量上传，最多 {MAX_UPLOAD_FILES} 个文件，仅限 PDF 格式
          </p>
        </Dragger>
      </Card>

      <Table columns={documentColumns} dataSource={documents} rowKey="id" loading={loading}
        pagination={{ total: docTotal, pageSize: 20 }} />

      {/* PDF 预览弹窗 */}
      <Modal
        open={previewOpen}
        title={previewTitle}
        footer={null}
        onCancel={() => {
          setPreviewOpen(false)
          if (previewUrl) URL.revokeObjectURL(previewUrl)
        }}
        width="80vw"
        styles={{ body: { height: '75vh', padding: 0 } }}
      >
        <iframe
          src={previewUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="PDF Preview"
        />
      </Modal>
    </div>
  )

  const renderChunks = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button onClick={() => { setViewMode('documents'); setSelectedDoc(null) }}>← 返回文档列表</Button>
          <Text strong>文档: {selectedDoc?.name}</Text>
          <Tag>共 {chunkTotal} 个分块</Tag>
        </Space>
      </div>
      <Table columns={chunkColumns} dataSource={chunks} rowKey="id" loading={loading}
        pagination={{ total: chunkTotal, pageSize: 20 }} />
    </div>
  )

  const renderRetrieval = () => (
    <div>
      <Card title="检索测试" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="选择知识库">
            <Select mode="multiple" placeholder="选择要检索的知识库" value={selectedDsIds}
              onChange={setSelectedDsIds} style={{ width: '100%' }}>
              {datasets.map((ds) => (
                <Select.Option key={ds.id} value={ds.id}>{ds.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="检索问题">
            <TextArea rows={3} value={retrievalQuestion}
              onChange={(e) => setRetrievalQuestion(e.target.value)}
              placeholder="输入要检索的问题，如：这家公司的盈利能力如何？" />
          </Form.Item>
          <Button type="primary" icon={<SearchOutlined />}
            onClick={handleRetrieval} loading={retrievalLoading}>
            检索
          </Button>
        </Form>
      </Card>
      {retrievalResults.length > 0 && (
        <Card title={`检索结果 (${retrievalResults.length} 个片段)`}>
          {retrievalResults.map((chunk, idx) => (
            <Card key={chunk.id} size="small" style={{ marginBottom: 8 }}
              title={
                <Space>
                  <Tag color="blue">#{idx + 1}</Tag>
                  <Text type="secondary">{chunk.document_name}</Text>
                  <Tag color="green">相关度 {(chunk.similarity * 100).toFixed(1)}%</Tag>
                </Space>
              }>
              <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{chunk.content}</Text>
            </Card>
          ))}
        </Card>
      )}
      {retrievalResults.length === 0 && !retrievalLoading && retrievalQuestion && (
        <Empty description="无检索结果" />
      )}
    </div>
  )

  const renderRagflowUi = () => (
    <div style={{ height: 'calc(100vh - 200px)' }}>
      {ragflowUiUrl ? (
        <iframe
          src={ragflowUiUrl}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
          title="RAGFlow UI"
          allow="clipboard-read; clipboard-write"
        />
      ) : (
        <Empty description="RAGFlow UI 地址未配置或服务离线" />
      )}
    </div>
  )

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="知识库数量" value={datasets.length} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总文档数"
              value={datasets.reduce((sum, ds) => sum + (ds.document_count || 0), 0)}
              prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总分块数"
              value={datasets.reduce((sum, ds) => sum + (ds.chunk_count || 0), 0)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="RAGFlow 状态"
              value={ragflowHealthy ? '在线' : '离线'}
              valueStyle={{ color: ragflowHealthy ? '#52c41a' : '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs activeKey={viewMode} onChange={(k) => setViewMode(k as ViewMode)}
          items={[
            { key: 'datasets', label: '知识库列表', icon: <DatabaseOutlined /> },
            ...(selectedDataset ? [{ key: 'documents' as const, label: `文档 - ${selectedDataset.name}`, icon: <FileTextOutlined /> }] : []),
            ...(selectedDoc ? [{ key: 'chunks' as const, label: `分块 - ${selectedDoc.name}`, icon: <FileTextOutlined /> }] : []),
            { key: 'retrieval', label: '检索测试', icon: <SearchOutlined /> },
            { key: 'ragflow-ui', label: 'RAGFlow 原生管理', icon: <LinkOutlined /> },
          ]}
        />
        {viewMode === 'datasets' && renderDatasets()}
        {viewMode === 'documents' && renderDocuments()}
        {viewMode === 'chunks' && renderChunks()}
        {viewMode === 'retrieval' && renderRetrieval()}
        {viewMode === 'ragflow-ui' && renderRagflowUi()}
      </Card>

      {/* 新建知识库弹窗 */}
      <Modal title="新建知识库" open={createDsOpen}
        onCancel={() => setCreateDsOpen(false)}
        onOk={() => dsForm.submit()} okText="创建">
        <Form form={dsForm} layout="vertical" onFinish={handleCreateDataset}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入知识库名称' }]}>
            <Input placeholder="如：股票研报库" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="可选" />
          </Form.Item>
          <Form.Item name="chunk_method" label="分块方式" initialValue="naive">
            <Select>
              <Select.Option value="naive">通用（Naive）</Select.Option>
              <Select.Option value="manual">手动</Select.Option>
              <Select.Option value="qa">QA 问答对</Select.Option>
              <Select.Option value="table">表格</Select.Option>
              <Select.Option value="paper">论文</Select.Option>
              <Select.Option value="book">书籍</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default KnowledgePage
