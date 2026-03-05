/**
 * 研报详情页 — 6 维度深度分析展示 + 可编辑图表/表格
 *
 * 核心功能：
 *   1. 展示 AI 深度分析的 6 个维度
 *   2. 财务图表（营收/利润趋势）可渲染 + 点击编辑 JSON
 *   3. 财务表格支持行内编辑
 *   4. 每个维度卡片支持编辑模式
 *   5. 编辑后自动保存到后端
 *   6. 解析状态轮询（parsing → analyzed）
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Rate, List, Row, Col, Spin, Button, Typography, Divider,
  Alert, Space, Table, message, Empty, Badge, Tabs,
} from 'antd'
import {
  ArrowLeftOutlined, RobotOutlined, BankOutlined, LineChartOutlined,
  DollarOutlined, BarChartOutlined, AlertOutlined, CheckCircleOutlined,
  SaveOutlined, EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getReport, generateDeepAnalysis, updateAnalysis, getReportStatus,
  type ReportDetail, type DeepAnalysis, type ChartData,
} from '@/api/reports'
import ChartRenderer from '@/components/ChartRenderer'
import EditableTable from '@/components/EditableTable'

const { Title, Text, Paragraph } = Typography

const RATING_COLOR: Record<string, string> = {
  '买入': '#52c41a', '增持': '#73d13d', '持有': '#fa8c16', '减持': '#ff4d4f',
}
const RISK_COLOR: Record<string, string> = {
  high: '#ff4d4f', medium: '#fa8c16', low: '#52c41a',
}
const RISK_LABEL: Record<string, string> = {
  high: '高风险', medium: '中等风险', low: '低风险',
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [analysis, setAnalysis] = useState<DeepAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // 加载研报数据
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getReport(id)
      .then((r) => {
        setReport(r)
        const deep = (r.summary as Record<string, unknown>)?.deepAnalysis as DeepAnalysis | undefined
        if (deep) setAnalysis(deep)
      })
      .catch(() => message.error('加载失败'))
      .finally(() => setLoading(false))
  }, [id])

  // 解析状态轮询
  useEffect(() => {
    if (!id || !report || report.status !== 'parsing') return
    const timer = setInterval(async () => {
      try {
        const st = await getReportStatus(id)
        if (st.status !== 'parsing') {
          clearInterval(timer)
          const r = await getReport(id)
          setReport(r)
          const deep = (r.summary as Record<string, unknown>)?.deepAnalysis as DeepAnalysis | undefined
          if (deep) setAnalysis(deep)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(timer)
  }, [id, report?.status])

  const handleAnalyze = async () => {
    if (!id) return
    setAnalyzing(true)
    try {
      const a = await generateDeepAnalysis(id)
      setAnalysis(a)
      setDirty(false)
      message.success('深度分析完成')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!id || !analysis) return
    setSaving(true)
    try {
      await updateAnalysis(id, analysis)
      setDirty(false)
      message.success('保存成功')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const updateField = useCallback((updater: (a: DeepAnalysis) => DeepAnalysis) => {
    setAnalysis((prev) => {
      if (!prev) return prev
      setDirty(true)
      return updater({ ...prev })
    })
  }, [])

  const handleChartChange = useCallback((field: 'revenueChart' | 'profitChart', data: ChartData) => {
    updateField((a) => ({
      ...a,
      financialAnalysis: { ...a.financialAnalysis, [field]: data },
    }))
  }, [updateField])

  const handleRevenueDataChange = useCallback((rows: string[][]) => {
    updateField((a) => ({
      ...a,
      financialAnalysis: {
        ...a.financialAnalysis,
        revenue: rows.map((r) => ({ year: r[0] || '', value: r[1] || '' })),
      },
    }))
  }, [updateField])

  const handleProfitDataChange = useCallback((rows: string[][]) => {
    updateField((a) => ({
      ...a,
      financialAnalysis: {
        ...a.financialAnalysis,
        netProfit: rows.map((r) => ({ year: r[0] || '', value: r[1] || '' })),
      },
    }))
  }, [updateField])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!report) return <Empty description="研报不存在" />

  const statusBadge = report.status === 'parsing'
    ? <Badge status="processing" text="解析中..." />
    : report.status === 'analyzed'
      ? <Badge status="success" text="已分析" />
      : report.status === 'error'
        ? <Badge status="error" text="解析失败" />
        : <Badge status="default" text="待分析" />

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>返回</Button>
        {!analysis && (
          <Button type="primary" icon={<RobotOutlined />} loading={analyzing} onClick={handleAnalyze}>
            生成深度分析
          </Button>
        )}
        {dirty && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存修改
          </Button>
        )}
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Title level={4}>{report.title || '未命名研报'}</Title>
        <Space>
          <Tag color={report.source === 'pdf' ? 'blue' : 'green'}>{report.source.toUpperCase()}</Tag>
          <Text type="secondary">{report.pages} 页</Text>
          {statusBadge}
          <Text type="secondary">{dayjs(report.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
        </Space>
      </Card>

      {!analysis ? (
        <Card>
          {report.status === 'parsing' ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">正在解析研报（视觉识别 + RAG 索引），请稍候...</Text>
              </div>
            </div>
          ) : (
            <Empty description="尚未进行深度分析">
              <Button type="primary" icon={<RobotOutlined />} loading={analyzing} onClick={handleAnalyze}>
                开始分析
              </Button>
            </Empty>
          )}
        </Card>
      ) : (
        <Tabs defaultActiveKey="overview" items={[
          { key: 'overview', label: '6维度分析', children: renderAnalysis(analysis, handleChartChange, handleRevenueDataChange, handleProfitDataChange) },
          { key: 'raw', label: '原文', children: <Card><Paragraph style={{ whiteSpace: 'pre-wrap', maxHeight: 600, overflow: 'auto' }}>{report.rawText?.slice(0, 10000) || '无原文'}</Paragraph></Card> },
        ]} />
      )}
    </div>
  )
}

function renderAnalysis(
  analysis: DeepAnalysis,
  onChartChange: (field: 'revenueChart' | 'profitChart', data: ChartData) => void,
  onRevenueChange: (rows: string[][]) => void,
  onProfitChange: (rows: string[][]) => void,
) {
  return (
    <>
      {/* 1. 公司概况 */}
      <Card title={<><BankOutlined /> 公司概况</>} style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
          <Descriptions.Item label="公司名称">{analysis.companyOverview.name}</Descriptions.Item>
          <Descriptions.Item label="股票代码">{analysis.companyOverview.code}</Descriptions.Item>
          <Descriptions.Item label="所属行业">{analysis.companyOverview.industry}</Descriptions.Item>
          {analysis.companyOverview.marketCap && (
            <Descriptions.Item label="市值">{analysis.companyOverview.marketCap}</Descriptions.Item>
          )}
          <Descriptions.Item label="主营业务" span={3}>
            {analysis.companyOverview.mainBusiness}
          </Descriptions.Item>
        </Descriptions>
        {analysis.companyOverview.highlights.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Text strong>核心亮点：</Text>
            <div style={{ marginTop: 8 }}>
              {analysis.companyOverview.highlights.map((h, i) => (
                <Tag key={i} color="blue" style={{ marginBottom: 4 }}>{h}</Tag>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 2. 行业分析 */}
      <Card title={<><LineChartOutlined /> 行业分析</>} style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="行业">{analysis.industryAnalysis.industryName}</Descriptions.Item>
          {analysis.industryAnalysis.marketSize && (
            <Descriptions.Item label="市场规模">{analysis.industryAnalysis.marketSize}</Descriptions.Item>
          )}
          {analysis.industryAnalysis.growthRate && (
            <Descriptions.Item label="增速">{analysis.industryAnalysis.growthRate}</Descriptions.Item>
          )}
          <Descriptions.Item label="公司地位" span={2}>
            {analysis.industryAnalysis.companyPosition}
          </Descriptions.Item>
        </Descriptions>
        <Paragraph style={{ marginTop: 12 }}>
          <Text strong>竞争格局：</Text> {analysis.industryAnalysis.competitiveLandscape}
        </Paragraph>
        {analysis.industryAnalysis.trends.length > 0 && (
          <div>
            <Text strong>行业趋势：</Text>
            <List size="small" dataSource={analysis.industryAnalysis.trends}
              renderItem={(t) => <List.Item>{t}</List.Item>} />
          </div>
        )}
      </Card>

      {/* 3. 财务分析（图表 + 可编辑表格） */}
      <Card title={<><DollarOutlined /> 财务分析</>} style={{ marginBottom: 16 }}>
        {/* 图表区域 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {analysis.financialAnalysis.revenueChart &&
            analysis.financialAnalysis.revenueChart.labels.length > 0 && (
            <Col xs={24} md={12}>
              <ChartRenderer
                data={analysis.financialAnalysis.revenueChart}
                editable
                onChange={(d) => onChartChange('revenueChart', d)}
                height={280}
              />
            </Col>
          )}
          {analysis.financialAnalysis.profitChart &&
            analysis.financialAnalysis.profitChart.labels.length > 0 && (
            <Col xs={24} md={12}>
              <ChartRenderer
                data={analysis.financialAnalysis.profitChart}
                editable
                onChange={(d) => onChartChange('profitChart', d)}
                height={280}
              />
            </Col>
          )}
        </Row>

        {/* 可编辑表格区域 */}
        <Row gutter={16}>
          {analysis.financialAnalysis.revenue && analysis.financialAnalysis.revenue.length > 0 && (
            <Col xs={24} md={12}>
              <EditableTable
                title="营收预测"
                columns={['年份', '营收']}
                data={analysis.financialAnalysis.revenue.map((r) => [r.year, r.value])}
                editable
                onChange={onRevenueChange}
              />
            </Col>
          )}
          {analysis.financialAnalysis.netProfit && analysis.financialAnalysis.netProfit.length > 0 && (
            <Col xs={24} md={12}>
              <EditableTable
                title="净利润预测"
                columns={['年份', '净利润']}
                data={analysis.financialAnalysis.netProfit.map((r) => [r.year, r.value])}
                editable
                onChange={onProfitChange}
              />
            </Col>
          )}
        </Row>

        <Divider />
        <Descriptions column={{ xs: 2, md: 4 }} size="small">
          {analysis.financialAnalysis.grossMargin && (
            <Descriptions.Item label="毛利率">{analysis.financialAnalysis.grossMargin}</Descriptions.Item>
          )}
          {analysis.financialAnalysis.netMargin && (
            <Descriptions.Item label="净利率">{analysis.financialAnalysis.netMargin}</Descriptions.Item>
          )}
          {analysis.financialAnalysis.roe && (
            <Descriptions.Item label="ROE">{analysis.financialAnalysis.roe}</Descriptions.Item>
          )}
          {analysis.financialAnalysis.debtRatio && (
            <Descriptions.Item label="负债率">{analysis.financialAnalysis.debtRatio}</Descriptions.Item>
          )}
        </Descriptions>
        <Row gutter={16} style={{ marginTop: 12 }}>
          <Col span={12}>
            <Text strong style={{ color: '#52c41a' }}>财务亮点：</Text>
            <List size="small" dataSource={analysis.financialAnalysis.highlights}
              renderItem={(h) => <List.Item><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{h}</List.Item>} />
          </Col>
          <Col span={12}>
            <Text strong style={{ color: '#fa8c16' }}>关注点：</Text>
            <List size="small" dataSource={analysis.financialAnalysis.concerns}
              renderItem={(c) => <List.Item><AlertOutlined style={{ color: '#fa8c16', marginRight: 8 }} />{c}</List.Item>} />
          </Col>
        </Row>
      </Card>

      {/* 4. 估值分析 */}
      <Card title={<><BarChartOutlined /> 估值分析</>} style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 2, md: 3 }} bordered size="small">
          {analysis.valuationAnalysis.currentPrice && (
            <Descriptions.Item label="当前价">{analysis.valuationAnalysis.currentPrice}</Descriptions.Item>
          )}
          {analysis.valuationAnalysis.targetPrice && (
            <Descriptions.Item label="目标价">
              <Text strong style={{ color: '#1677ff' }}>{analysis.valuationAnalysis.targetPrice}</Text>
            </Descriptions.Item>
          )}
          {analysis.valuationAnalysis.pe && (
            <Descriptions.Item label="PE">{analysis.valuationAnalysis.pe}</Descriptions.Item>
          )}
          {analysis.valuationAnalysis.pb && (
            <Descriptions.Item label="PB">{analysis.valuationAnalysis.pb}</Descriptions.Item>
          )}
          {analysis.valuationAnalysis.peg && (
            <Descriptions.Item label="PEG">{analysis.valuationAnalysis.peg}</Descriptions.Item>
          )}
          {analysis.valuationAnalysis.valuationMethod && (
            <Descriptions.Item label="估值方法">{analysis.valuationAnalysis.valuationMethod}</Descriptions.Item>
          )}
        </Descriptions>
        <Alert type="info" style={{ marginTop: 12 }}
          message="估值结论" description={analysis.valuationAnalysis.conclusion} />
      </Card>

      {/* 5. 总结评分 */}
      <Card title={<><CheckCircleOutlined /> 总结</>} style={{ marginBottom: 16 }}>
        <Row gutter={24} align="middle">
          <Col>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: '#1677ff', lineHeight: 1 }}>
                {analysis.summary.score}
              </div>
              <Rate disabled value={analysis.summary.score} count={5} />
              <div>
                <Tag color={RATING_COLOR[analysis.summary.rating] || '#1677ff'}
                  style={{ fontSize: 14, padding: '2px 12px', marginTop: 8 }}>
                  {analysis.summary.rating}
                </Tag>
              </div>
            </div>
          </Col>
          <Col flex="1">
            <Paragraph style={{ fontSize: 16, fontWeight: 500 }}>
              {analysis.summary.coreLogic}
            </Paragraph>
            <Divider style={{ margin: '8px 0' }} />
            <Text strong>关键要点：</Text>
            <List size="small" dataSource={analysis.summary.keyPoints}
              renderItem={(p) => <List.Item>{p}</List.Item>} />
            {analysis.summary.catalysts.length > 0 && (
              <>
                <Text strong>催化剂：</Text>
                <div style={{ marginTop: 4 }}>
                  {analysis.summary.catalysts.map((c, i) => (
                    <Tag key={i} color="green" style={{ marginBottom: 4 }}>{c}</Tag>
                  ))}
                </div>
              </>
            )}
          </Col>
        </Row>
      </Card>

      {/* 6. 风险提示 */}
      <Card title={<><AlertOutlined /> 风险提示</>}
        extra={<Tag color={RISK_COLOR[analysis.riskWarnings.level]}>
          {RISK_LABEL[analysis.riskWarnings.level]}
        </Tag>}>
        <List dataSource={analysis.riskWarnings.risks}
          renderItem={(r) => (
            <List.Item>
              <List.Item.Meta
                title={<Tag color="red">{r.category}</Tag>}
                description={r.description}
              />
            </List.Item>
          )} />
      </Card>
    </>
  )
}
