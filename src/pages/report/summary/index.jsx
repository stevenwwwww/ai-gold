import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { reportService } from '@/services/report/ReportService'
import { usePageTheme } from '@/components/ThemeProvider'
import './index.scss'

const RATING_MAP = {
  买入: { icon: '🟢', color: '#10B981' },
  增持: { icon: '🔵', color: '#3B82F6' },
  持有: { icon: '🟡', color: '#F59E0B' },
  减持: { icon: '🔴', color: '#EF4444' }
}

export default function ReportSummary() {
  const router = useRouter()
  const tc = usePageTheme()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = router.params?.id
    if (!id) {
      Taro.showToast({ title: '缺少研报ID', icon: 'none' })
      return
    }
    setLoading(true)
    reportService.getReport(id)
      .then((r) => setReport(r))
      .catch(() => Taro.showToast({ title: '加载失败', icon: 'none' }))
      .finally(() => setLoading(false))
  }, [router.params?.id])

  const goChat = () => {
    if (report?.id) {
      Taro.navigateTo({
        url: `/pages/report/chat/index?id=${report.id}`
      })
    }
  }

  if (loading || !report) {
    return (
      <View className={`report-summary ${tc}`}>
        <View className="report-summary-empty">
          <Text>{loading ? '加载中...' : '研报不存在'}</Text>
        </View>
      </View>
    )
  }

  const s = report.summary || {}
  const ratingInfo = RATING_MAP[s.rating] || { icon: '⚪', color: '#6B7280' }

  return (
    <View className={`report-summary ${tc}`}>
      <ScrollView scrollY className="report-summary-body">
        <View className="report-summary-card">
          <Text className="report-summary-stock">
            {s.stockName || '-'} {s.stockCode ? `(${s.stockCode})` : ''}
          </Text>
          <Text className="report-summary-title">{s.reportTitle || report.title}</Text>
          <View className="report-summary-meta">
            <Text>{s.institution || '-'}</Text>
            <Text>{s.analyst ? `分析师: ${s.analyst}` : ''}</Text>
            <Text>{s.publishDate || ''}</Text>
          </View>
        </View>

        <View className="report-summary-card report-summary-rating">
          <View className="report-summary-rating-row">
            <Text className="report-summary-rating-icon">{ratingInfo.icon}</Text>
            <Text
              className="report-summary-rating-text"
              style={{ color: ratingInfo.color }}
            >
              {s.rating || '-'}
            </Text>
          </View>
          {(s.targetPrice || s.currentPrice) && (
            <View className="report-summary-price">
              <Text>目标价 {s.targetPrice || '-'}</Text>
              {s.currentPrice && <Text>现价 {s.currentPrice}</Text>}
              {s.potentialGain && (
                <Text className="report-summary-gain">{s.potentialGain}</Text>
              )}
            </View>
          )}
        </View>

        {s.coreLogic && (
          <View className="report-summary-card">
            <Text className="report-summary-label">核心逻辑</Text>
            <Text className="report-summary-value">{s.coreLogic}</Text>
          </View>
        )}

        {s.financialForecast && s.financialForecast.length > 0 && (
          <View className="report-summary-card">
            <Text className="report-summary-label">财务预测</Text>
            <View className="report-summary-forecast">
              {s.financialForecast.map((f, i) => (
                <View key={i} className="report-summary-forecast-item">
                  <Text>{f.year}年</Text>
                  <Text>营收 {f.revenue || '-'}</Text>
                  <Text>净利 {f.profit || '-'}</Text>
                  <Text>EPS {f.eps || '-'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {s.catalysts && s.catalysts.length > 0 && (
          <View className="report-summary-card">
            <Text className="report-summary-label">催化剂</Text>
            {s.catalysts.map((c, i) => (
              <Text key={i} className="report-summary-list-item">• {c}</Text>
            ))}
          </View>
        )}

        {s.risks && s.risks.length > 0 && (
          <View className="report-summary-card">
            <Text className="report-summary-label">风险提示</Text>
            {s.risks.map((r, i) => (
              <Text key={i} className="report-summary-list-item risk">• {r}</Text>
            ))}
          </View>
        )}

        <View className="report-summary-cta" onClick={goChat}>
          <Text className="report-summary-cta-text">深挖研报，向 AI 提问</Text>
          <Text className="report-summary-cta-arrow">›</Text>
        </View>
      </ScrollView>
    </View>
  )
}
