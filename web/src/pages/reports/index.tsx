/**
 * 研报管理页 — 生产级列表
 *
 * 功能：
 *   - PDF 上传 + 文本粘贴
 *   - 表格展示（标题/来源/状态/公司/行业/评级/评分/时间）
 *   - 行内标题编辑
 *   - 触发深度分析
 *   - 单条删除 + 批量删除
 *   - 解析状态实时反馈
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, Button, Space, Upload, Input, Modal, Tag, message,
  Popconfirm, Typography, Badge,
} from 'antd'
import {
  UploadOutlined, FileTextOutlined, DeleteOutlined, EyeOutlined,
  RobotOutlined, EditOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getReports, deleteReport, batchDeleteReports, uploadPdf, parseText,
  generateSummary, generateDeepAnalysis, updateTitle,
  type ReportItem, type DeepAnalysis,
} from '@/api/reports'

const { TextArea } = Input

export default function ReportsPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<ReportItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pasteModal, setPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingTitle, setEditingTitle] = useState<{ id: string; value: string } | null>(null)

  const loadData = useCallback(() => {
    setLoading(true)
    getReports({ limit: 100, offset: 0 })
      .then((res) => { setData(res.data); setTotal(res.total) })
      .catch(() => message.error('加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(loadData, [loadData])

  const handleUploadPdf = async (file: File) => {
    setUploading(true)
    try {
      const { reportId } = await uploadPdf(file)
      message.success('PDF 上传成功，正在后台解析...')
      // 先生成摘要
      try {
        await generateSummary(reportId)
      } catch { /* ignore */ }
      loadData()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '上传失败')
    } finally {
      setUploading(false)
    }
    return false
  }

  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) { message.warning('请输入内容'); return }
    setUploading(true)
    try {
      const { reportId } = await parseText(pasteText)
      message.success('文本解析成功，正在生成摘要…')
      await generateSummary(reportId)
      setPasteModal(false)
      setPasteText('')
      loadData()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '解析失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDeepAnalyze = async (id: string) => {
    setAnalyzingId(id)
    try {
      await generateDeepAnalysis(id)
      message.success('深度分析完成')
      loadData()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '分析失败')
    } finally {
      setAnalyzingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteReport(id)
      message.success('删除成功')
      setData((prev) => prev.filter((r) => r.id !== id))
    } catch {
      message.error('删除失败')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    try {
      const cnt = await batchDeleteReports(selectedIds)
      message.success(`成功删除 ${cnt} 条`)
      setSelectedIds([])
      loadData()
    } catch {
      message.error('批量删除失败')
    }
  }

  const handleTitleSave = async () => {
    if (!editingTitle) return
    try {
      await updateTitle(editingTitle.id, editingTitle.value)
      setData((prev) => prev.map((r) =>
        r.id === editingTitle.id ? { ...r, title: editingTitle.value } : r
      ))
      setEditingTitle(null)
    } catch {
      message.error('更新失败')
    }
  }

  const columns: ColumnsType<ReportItem> = [
    {
      title: '标题', dataIndex: 'title', key: 'title', ellipsis: true,
      render: (t: string, r: ReportItem) => {
        if (editingTitle?.id === r.id) {
          return (
            <Space size="small">
              <Input
                size="small"
                value={editingTitle.value}
                onChange={(e) => setEditingTitle({ ...editingTitle, value: e.target.value })}
                onPressEnter={handleTitleSave}
                style={{ width: 200 }}
              />
              <Button size="small" type="link" icon={<CheckOutlined />} onClick={handleTitleSave} />
              <Button size="small" type="link" icon={<CloseOutlined />} onClick={() => setEditingTitle(null)} />
            </Space>
          )
        }
        return (
          <Space size="small">
            <span>{t || '未命名研报'}</span>
            <Button size="small" type="link" icon={<EditOutlined />}
              onClick={(e) => { e.stopPropagation(); setEditingTitle({ id: r.id, value: t || '' }) }} />
          </Space>
        )
      },
    },
    {
      title: '来源', dataIndex: 'source', key: 'source', width: 80,
      render: (s: string) => <Tag color={s === 'pdf' ? 'blue' : 'green'}>{s.toUpperCase()}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => {
        const cfg = { pending: { status: 'default' as const, text: '待分析' }, parsing: { status: 'processing' as const, text: '解析中' }, analyzed: { status: 'success' as const, text: '已分析' }, error: { status: 'error' as const, text: '失败' } }
        const c = cfg[s as keyof typeof cfg] || cfg.pending
        return <Badge status={c.status} text={c.text} />
      },
    },
    {
      title: '公司', key: 'company', width: 120,
      render: (_: unknown, r: ReportItem) => {
        const deep = (r.summary as Record<string, unknown>)?.deepAnalysis as DeepAnalysis | undefined
        return deep?.companyOverview?.name || '-'
      },
    },
    {
      title: '行业', key: 'industry', width: 100,
      render: (_: unknown, r: ReportItem) => {
        const deep = (r.summary as Record<string, unknown>)?.deepAnalysis as DeepAnalysis | undefined
        return deep?.companyOverview?.industry || '-'
      },
    },
    {
      title: '评级', key: 'rating', width: 80,
      render: (_: unknown, r: ReportItem) => {
        const deep = (r.summary as Record<string, unknown>)?.deepAnalysis as DeepAnalysis | undefined
        const rating = deep?.summary?.rating
        if (!rating) return '-'
        const color = { '买入': '#52c41a', '增持': '#73d13d', '持有': '#fa8c16', '减持': '#ff4d4f' }
        return <Tag color={color[rating as keyof typeof color] || undefined}>{rating}</Tag>
      },
    },
    {
      title: '评分', key: 'score', width: 80,
      render: (_: unknown, r: ReportItem) => {
        const deep = (r.summary as Record<string, unknown>)?.deepAnalysis as DeepAnalysis | undefined
        const score = deep?.summary?.score
        if (!score) return '-'
        const color = score >= 4 ? '#52c41a' : score >= 3 ? '#fa8c16' : '#ff4d4f'
        return <span style={{ color, fontWeight: 600 }}>{score}/5</span>
      },
    },
    {
      title: '时间', dataIndex: 'createdAt', key: 'time', width: 140,
      render: (t: number) => dayjs(t).format('MM-DD HH:mm'),
      sorter: (a, b) => a.createdAt - b.createdAt,
    },
    {
      title: '操作', key: 'action', width: 240, fixed: 'right',
      render: (_: unknown, record: ReportItem) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/reports/${record.id}`)}>查看</Button>
          <Button size="small" type="primary" icon={<RobotOutlined />}
            loading={analyzingId === record.id}
            onClick={() => handleDeepAnalyze(record.id)}>分析</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card title={`研报管理 (共 ${total} 条)`} extra={
        <Space>
          {selectedIds.length > 0 && (
            <Popconfirm title={`确认删除 ${selectedIds.length} 条？`} onConfirm={handleBatchDelete}>
              <Button danger icon={<DeleteOutlined />}>批量删除 ({selectedIds.length})</Button>
            </Popconfirm>
          )}
          <Upload accept=".pdf" showUploadList={false} beforeUpload={handleUploadPdf}>
            <Button icon={<UploadOutlined />} loading={uploading} type="primary">上传 PDF</Button>
          </Upload>
          <Button icon={<FileTextOutlined />} onClick={() => setPasteModal(true)}>粘贴文本</Button>
        </Space>
      }>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as string[]),
          }}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal title="粘贴研报文本" open={pasteModal} onCancel={() => setPasteModal(false)}
        onOk={handlePasteSubmit} confirmLoading={uploading} width={640}>
        <TextArea rows={10} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
          placeholder="请粘贴研报文本内容…" />
      </Modal>
    </div>
  )
}
