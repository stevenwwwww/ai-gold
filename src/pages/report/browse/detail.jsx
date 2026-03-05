/**
 * 研报详情页（只读）
 * 展示 6 维度深度分析结果，不支持编辑
 * 小程序端专用
 */
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { reportService } from '@/services/report/ReportService'
import { usePageTheme } from '@/components/ThemeProvider'
import './detail.scss'

export default function ReportBrowseDetail() {
  const tc = usePageTheme()
  const router = useRouter()
  const id = router.params.id
  const [report, setReport] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    reportService.getReport(id)
      .then((r) => {
        setReport(r)
        if (r.summary?.deepAnalysis) {
          setAnalysis(r.summary.deepAnalysis)
        }
      })
      .catch(() => Taro.showToast({ title: '加载失败', icon: 'none' }))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <View className={`detail ${tc}`}><View className='detail-loading'><Text>加载中...</Text></View></View>
  }
  if (!report) {
    return <View className={`detail ${tc}`}><View className='detail-loading'><Text>研报不存在</Text></View></View>
  }

  const ratingColor = { '买入': '#52c41a', '增持': '#73d13d', '持有': '#fa8c16', '减持': '#ff4d4f' }

  return (
    <View className={`detail ${tc}`}>
      <ScrollView scrollY className='detail-body'>
        {/* 头部信息 */}
        <View className='detail-header'>
          <Text className='detail-title'>{report.title || '未命名研报'}</Text>
          <View className='detail-meta'>
            <Text className='detail-tag'>{report.source.toUpperCase()}</Text>
            <Text className='detail-meta-text'>{report.pages || 0} 页</Text>
            <Text className='detail-meta-text'>{new Date(report.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>

        {!analysis ? (
          <View className='detail-empty'><Text>该研报尚未进行深度分析</Text></View>
        ) : (
          <>
            {/* 评分卡片 */}
            <View className='detail-score-card'>
              <View className='detail-score-main'>
                <Text className='detail-score-num'>{analysis.summary?.score || '-'}</Text>
                <Text className='detail-score-max'>/ 5</Text>
              </View>
              {analysis.summary?.rating && (
                <Text className='detail-rating' style={{ color: ratingColor[analysis.summary.rating] || '#999' }}>
                  {analysis.summary.rating}
                </Text>
              )}
              {analysis.summary?.coreLogic && (
                <Text className='detail-core-logic'>{analysis.summary.coreLogic}</Text>
              )}
            </View>

            {/* 1. 公司概况 */}
            <View className='detail-section'>
              <Text className='detail-section-title'>公司概况</Text>
              <View className='detail-info-grid'>
                <View className='detail-info-item'>
                  <Text className='detail-info-label'>公司名称</Text>
                  <Text className='detail-info-value'>{analysis.companyOverview?.name || '-'}</Text>
                </View>
                <View className='detail-info-item'>
                  <Text className='detail-info-label'>股票代码</Text>
                  <Text className='detail-info-value'>{analysis.companyOverview?.code || '-'}</Text>
                </View>
                <View className='detail-info-item'>
                  <Text className='detail-info-label'>行业</Text>
                  <Text className='detail-info-value'>{analysis.companyOverview?.industry || '-'}</Text>
                </View>
                {analysis.companyOverview?.marketCap && (
                  <View className='detail-info-item'>
                    <Text className='detail-info-label'>市值</Text>
                    <Text className='detail-info-value'>{analysis.companyOverview.marketCap}</Text>
                  </View>
                )}
              </View>
              {analysis.companyOverview?.mainBusiness && (
                <Text className='detail-desc'>{analysis.companyOverview.mainBusiness}</Text>
              )}
              {analysis.companyOverview?.highlights?.length > 0 && (
                <View className='detail-tags'>
                  {analysis.companyOverview.highlights.map((h, i) => (
                    <Text key={i} className='detail-highlight-tag'>{h}</Text>
                  ))}
                </View>
              )}
            </View>

            {/* 2. 行业分析 */}
            <View className='detail-section'>
              <Text className='detail-section-title'>行业分析</Text>
              <View className='detail-info-grid'>
                <View className='detail-info-item'>
                  <Text className='detail-info-label'>行业</Text>
                  <Text className='detail-info-value'>{analysis.industryAnalysis?.industryName || '-'}</Text>
                </View>
                {analysis.industryAnalysis?.marketSize && (
                  <View className='detail-info-item'>
                    <Text className='detail-info-label'>规模</Text>
                    <Text className='detail-info-value'>{analysis.industryAnalysis.marketSize}</Text>
                  </View>
                )}
                {analysis.industryAnalysis?.growthRate && (
                  <View className='detail-info-item'>
                    <Text className='detail-info-label'>增速</Text>
                    <Text className='detail-info-value'>{analysis.industryAnalysis.growthRate}</Text>
                  </View>
                )}
              </View>
              {analysis.industryAnalysis?.competitiveLandscape && (
                <Text className='detail-desc'>竞争格局：{analysis.industryAnalysis.competitiveLandscape}</Text>
              )}
              {analysis.industryAnalysis?.trends?.length > 0 && (
                <View className='detail-list'>
                  {analysis.industryAnalysis.trends.map((t, i) => (
                    <Text key={i} className='detail-list-item'>• {t}</Text>
                  ))}
                </View>
              )}
            </View>

            {/* 3. 财务分析 */}
            <View className='detail-section'>
              <Text className='detail-section-title'>财务分析</Text>
              <View className='detail-info-grid'>
                {analysis.financialAnalysis?.grossMargin && (
                  <View className='detail-info-item'>
                    <Text className='detail-info-label'>毛利率</Text>
                    <Text className='detail-info-value'>{analysis.financialAnalysis.grossMargin}</Text>
                  </View>
                )}
                {analysis.financialAnalysis?.netMargin && (
                  <View className='detail-info-item'>
                    <Text className='detail-info-label'>净利率</Text>
                    <Text className='detail-info-value'>{analysis.financialAnalysis.netMargin}</Text>
                  </View>
                )}
                {analysis.financialAnalysis?.roe && (
                  <View className='detail-info-item'>
                    <Text className='detail-info-label'>ROE</Text>
                    <Text className='detail-info-value'>{analysis.financialAnalysis.roe}</Text>
                  </View>
                )}
                {analysis.financialAnalysis?.debtRatio && (
                  <View className='detail-info-item'>
                    <Text className='detail-info-label'>负债率</Text>
                    <Text className='detail-info-value'>{analysis.financialAnalysis.debtRatio}</Text>
                  </View>
                )}
              </View>

              {/* 营收表格 */}
              {analysis.financialAnalysis?.revenue?.length > 0 && (
                <View className='detail-table'>
                  <Text className='detail-table-title'>营收预测</Text>
                  <View className='detail-table-header'>
                    <Text className='detail-table-cell'>年份</Text>
                    <Text className='detail-table-cell'>营收</Text>
                  </View>
                  {analysis.financialAnalysis.revenue.map((r, i) => (
                    <View key={i} className='detail-table-row'>
                      <Text className='detail-table-cell'>{r.year}</Text>
                      <Text className='detail-table-cell'>{r.value}</Text>
                    </View>
                  ))}
                </View>
              )}

              {analysis.financialAnalysis?.highlights?.length > 0 && (
                <View className='detail-list'>
                  <Text className='detail-list-label' style={{ color: '#52c41a' }}>亮点</Text>
                  {analysis.financialAnalysis.highlights.map((h, i) => (
                    <Text key={i} className='detail-list-item'>✓ {h}</Text>
                  ))}
                </View>
              )}
              {analysis.financialAnalysis?.concerns?.length > 0 && (
                <View className='detail-list'>
                  <Text className='detail-list-label' style={{ color: '#fa8c16' }}>关注</Text>
                  {analysis.financialAnalysis.concerns.map((c, i) => (
                    <Text key={i} className='detail-list-item'>! {c}</Text>
                  ))}
                </View>
              )}
            </View>

            {/* 4. 估值分析 */}
            <View className='detail-section'>
              <Text className='detail-section-title'>估值分析</Text>
              <View className='detail-info-grid'>
                {analysis.valuationAnalysis?.currentPrice && (
                  <View className='detail-info-item'>
                    <Text className='detail-info-label'>当前价</Text>
                    <Text className='detail-info-value'>{analysis.valuationAnalysis.currentPrice}</Text>
                  </View>
                )}
                {analysis.valuationAnalysis?.targetPrice && (
                  <View className='detail-info-item'>
                    <Text className='detail-info-label'>目标价</Text>
                    <Text className='detail-info-value' style={{ color: '#1677ff', fontWeight: 600 }}>
                      {analysis.valuationAnalysis.targetPrice}
                    </Text>
                  </View>
                )}
                {analysis.valuationAnalysis?.pe && (
                  <View className='detail-info-item'>
                    <Text className='detail-info-label'>PE</Text>
                    <Text className='detail-info-value'>{analysis.valuationAnalysis.pe}</Text>
                  </View>
                )}
              </View>
              {analysis.valuationAnalysis?.conclusion && (
                <View className='detail-conclusion'>
                  <Text className='detail-conclusion-text'>{analysis.valuationAnalysis.conclusion}</Text>
                </View>
              )}
            </View>

            {/* 5. 要点 & 催化剂 */}
            <View className='detail-section'>
              <Text className='detail-section-title'>关键要点</Text>
              {analysis.summary?.keyPoints?.length > 0 && (
                <View className='detail-list'>
                  {analysis.summary.keyPoints.map((p, i) => (
                    <Text key={i} className='detail-list-item'>• {p}</Text>
                  ))}
                </View>
              )}
              {analysis.summary?.catalysts?.length > 0 && (
                <View className='detail-tags'>
                  <Text className='detail-list-label'>催化剂：</Text>
                  {analysis.summary.catalysts.map((c, i) => (
                    <Text key={i} className='detail-catalyst-tag'>{c}</Text>
                  ))}
                </View>
              )}
            </View>

            {/* 6. 风险提示 */}
            <View className='detail-section detail-risk-section'>
              <Text className='detail-section-title'>风险提示</Text>
              {analysis.riskWarnings?.risks?.length > 0 && (
                <View className='detail-list'>
                  {analysis.riskWarnings.risks.map((r, i) => (
                    <View key={i} className='detail-risk-item'>
                      <Text className='detail-risk-category'>{r.category}</Text>
                      <Text className='detail-risk-desc'>{r.description}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
