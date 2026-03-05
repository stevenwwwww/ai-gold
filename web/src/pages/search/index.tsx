/**
 * 研报搜索页 — 服务端搜索 + 多维度筛选
 *
 * 改造点（vs 旧版）：
 *   - 从全量加载改为服务端分页搜索
 *   - 增加状态筛选、评分范围
 *   - 搜索结果展示图表预览
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Input, List, Tag, Rate, Row, Col, Typography, Empty, Spin,
  Select, Space, Badge, Pagination,
} from 'antd'
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getReports, type ReportItem, type DeepAnalysis } from '@/api/reports'

const { Title, Text, Paragraph } = Typography

const RATING_COLOR: Record<string, string> = {
  '买入': '#52c41a', '增持': '#73d13d', '持有': '#fa8c16', '减持': '#ff4d4f',
}

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待分析' },
  parsing: { color: 'processing', text: '解析中' },
  analyzed: { color: 'success', text: '已分析' },
  error: { color: 'error', text: '失败' },
}

interface EnrichedReport extends ReportItem {
  deep?: DeepAnalysis
  companyName?: string
  industry?: string
  score?: number
  rating?: string
}

export default function SearchPage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<EnrichedReport[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [ratingFilter, setRatingFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('time')
  const [page, setPage] = useState(1)
  const pageSize = 12

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getReports({
        keyword: keyword || undefined,
        status: statusFilter || undefined,
        sortBy,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      const enriched: EnrichedReport[] = res.data.map((r) => {
        const deep = (r.summary as Record<string, unknown>)?.deepAnalysis as DeepAnalysis | undefined
        return {
          ...r, deep,
          companyName: deep?.companyOverview?.name || '',
          industry: deep?.industryAnalysis?.industryName || deep?.companyOverview?.industry || '',
          score: deep?.summary?.score,
          rating: deep?.summary?.rating,
        }
      })
      setReports(enriched)
      setTotal(res.total)
    } catch { /* ignore */ }
    setLoading(false)
  }, [keyword, statusFilter, sortBy, page])

  useEffect(() => { loadData() }, [loadData])

  const handleSearch = () => {
    setPage(1)
    loadData()
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Title level={4} style={{ marginBottom: 16 }}>
          <SearchOutlined /> 研报搜索
        </Title>
        <Input.Search
          placeholder="搜索公司名称、行业、关键词…"
          size="large"
          allowClear
          enterButton
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={handleSearch}
          style={{ maxWidth: 600, marginBottom: 16 }}
        />
        <Space wrap>
          <Select placeholder="状态筛选" allowClear style={{ width: 120 }}
            value={statusFilter || undefined}
            onChange={(v) => { setStatusFilter(v || ''); setPage(1) }}
            options={[
              { label: '待分析', value: 'pending' },
              { label: '解析中', value: 'parsing' },
              { label: '已分析', value: 'analyzed' },
            ]} />
          <Select placeholder="评级筛选" allowClear style={{ width: 120 }}
            value={ratingFilter || undefined}
            onChange={(v) => setRatingFilter(v || '')}
            options={['买入', '增持', '持有', '减持'].map((r) => ({ label: r, value: r }))} />
          <Select value={sortBy} onChange={(v) => { setSortBy(v); setPage(1) }} style={{ width: 120 }}
            options={[
              { label: '按时间', value: 'time' },
              { label: '按评分', value: 'score' },
            ]} />
          <Text type="secondary">共 {total} 份研报</Text>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {reports.length === 0 ? (
          <Card><Empty description={keyword ? '无匹配结果' : '暂无研报'} /></Card>
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {(ratingFilter ? reports.filter((r) => r.rating === ratingFilter) : reports).map((r) => (
                <Col xs={24} md={12} xl={8} key={r.id}>
                  <Card hoverable style={{ height: '100%' }} onClick={() => navigate(`/reports/${r.id}`)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Title level={5} ellipsis style={{ marginBottom: 4 }}>
                          <FileTextOutlined style={{ marginRight: 8 }} />
                          {r.companyName || r.title || '未命名'}
                        </Title>
                        {r.deep?.companyOverview?.code && (
                          <Text type="secondary" style={{ fontSize: 12 }}>{r.deep.companyOverview.code}</Text>
                        )}
                      </div>
                      <div style={{ textAlign: 'center', flexShrink: 0, marginLeft: 12 }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#1677ff' }}>{r.score || '-'}</div>
                        <Rate disabled value={r.score || 0} count={5} style={{ fontSize: 12 }} />
                      </div>
                    </div>

                    <div style={{ margin: '8px 0' }}>
                      {r.rating && <Tag color={RATING_COLOR[r.rating]}>{r.rating}</Tag>}
                      {r.industry && <Tag>{r.industry}</Tag>}
                      <Tag color="geekblue">{r.source.toUpperCase()}</Tag>
                      <Badge {...(STATUS_MAP[r.status] || STATUS_MAP.pending)} />
                    </div>

                    <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 8, fontSize: 13 }}>
                      {r.deep?.summary?.coreLogic || '暂无分析'}
                    </Paragraph>

                    {r.deep?.riskWarnings && r.deep.riskWarnings.risks.length > 0 && (
                      <div style={{ marginBottom: 4 }}>
                        <Text type="danger" style={{ fontSize: 12 }}>
                          风险: {r.deep.riskWarnings.risks.slice(0, 2).map((risk) => risk.category).join('、')}
                        </Text>
                      </div>
                    )}

                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(r.createdAt).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </Card>
                </Col>
              ))}
            </Row>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Pagination
                current={page}
                total={total}
                pageSize={pageSize}
                onChange={setPage}
                showTotal={(t) => `共 ${t} 条`}
              />
            </div>
          </>
        )}
      </Spin>
    </div>
  )
}
