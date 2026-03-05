import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, List, Typography, Spin } from 'antd'
import { FileTextOutlined, RiseOutlined, StarOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getReports, getReportStats, type ReportItem, type ReportStats } from '@/api/reports'
import { useAuthStore } from '@/store/auth'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [reports, setReports] = useState<ReportItem[]>([])
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getReports({ limit: 10, offset: 0 }),
      getReportStats(),
    ])
      .then(([res, s]) => { setReports(res.data); setStats(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        欢迎回来，{user?.displayName}
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/reports')}>
            <Statistic title="研报总数" value={stats?.total ?? 0} prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="已分析" value={stats?.analyzed ?? 0}
              prefix={<RiseOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="平均评分" value={stats?.avgScore ?? 0} suffix="/ 5"
              prefix={<StarOutlined />} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="本月新增" prefix={<ClockCircleOutlined />}
              value={stats?.thisMonth ?? 0}
              valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      <Card title="最近研报" extra={<a onClick={() => navigate('/reports')}>查看全部</a>}>
        <Spin spinning={loading}>
          <List dataSource={reports.slice(0, 5)} renderItem={(item) => (
            <List.Item
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/reports/${item.id}`)}
              extra={<Text type="secondary">{dayjs(item.createdAt).format('MM-DD HH:mm')}</Text>}
            >
              <List.Item.Meta
                title={item.title || '未命名研报'}
                description={`来源: ${item.source === 'pdf' ? 'PDF' : '文本'} · ${item.pages || 0} 页`}
              />
            </List.Item>
          )} />
        </Spin>
      </Card>
    </div>
  )
}
