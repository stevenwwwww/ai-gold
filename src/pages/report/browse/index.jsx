/**
 * 研报浏览列表（只读）
 * 展示所有已分析的研报，搜索筛选，点击查看详情
 * 小程序端只有查看功能，不支持增删改查
 */
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { reportService } from '@/services/report/ReportService'
import { usePageTheme } from '@/components/ThemeProvider'
import './index.scss'

export default function ReportBrowse() {
  const tc = usePageTheme()
  const [list, setList] = useState([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reportService.getReportList()
      .then((data) => setList(data || []))
      .catch(() => Taro.showToast({ title: '加载失败', icon: 'none' }))
      .finally(() => setLoading(false))
  }, [])

  const getAnalysis = (r) => {
    if (!r.summary?.deepAnalysis) return null
    return r.summary.deepAnalysis
  }

  const filtered = keyword.trim()
    ? list.filter((r) => {
        const kw = keyword.toLowerCase()
        const a = getAnalysis(r)
        return (r.title || '').toLowerCase().includes(kw) ||
          (a?.companyOverview?.name || '').toLowerCase().includes(kw) ||
          (a?.companyOverview?.industry || '').toLowerCase().includes(kw)
      })
    : list

  const analyzed = filtered.filter((r) => getAnalysis(r))

  const goDetail = (id) => {
    Taro.navigateTo({ url: `/pages/report/browse/detail?id=${id}` })
  }

  const ratingColor = { '买入': '#52c41a', '增持': '#73d13d', '持有': '#fa8c16', '减持': '#ff4d4f' }

  return (
    <View className={`browse ${tc}`}>
      <View className='browse-header'>
        <Input
          className='browse-search'
          placeholder='搜索公司、行业...'
          value={keyword}
          onInput={(e) => setKeyword(e.detail?.value || '')}
        />
        <Text className='browse-count'>{analyzed.length} 份</Text>
      </View>

      <ScrollView scrollY className='browse-body'>
        {loading ? (
          <View className='browse-empty'><Text>加载中...</Text></View>
        ) : analyzed.length === 0 ? (
          <View className='browse-empty'><Text>{keyword ? '无匹配结果' : '暂无已分析研报'}</Text></View>
        ) : (
          analyzed.map((r) => {
            const a = getAnalysis(r)
            return (
              <View key={r.id} className='browse-card' onClick={() => goDetail(r.id)}>
                <View className='browse-card-top'>
                  <View className='browse-card-left'>
                    <Text className='browse-card-name'>
                      {a?.companyOverview?.name || r.title || '未命名'}
                    </Text>
                    {a?.companyOverview?.code && (
                      <Text className='browse-card-code'>{a.companyOverview.code}</Text>
                    )}
                  </View>
                  <View className='browse-card-score'>
                    <Text className='browse-card-score-num'>{a?.summary?.score || '-'}</Text>
                    <Text className='browse-card-score-label'>评分</Text>
                  </View>
                </View>

                <View className='browse-card-tags'>
                  {a?.summary?.rating && (
                    <Text className='browse-tag' style={{ color: ratingColor[a.summary.rating] || '#999' }}>
                      {a.summary.rating}
                    </Text>
                  )}
                  {a?.companyOverview?.industry && (
                    <Text className='browse-tag'>{a.companyOverview.industry}</Text>
                  )}
                  <Text className='browse-tag-source'>{r.source.toUpperCase()}</Text>
                </View>

                {a?.summary?.coreLogic && (
                  <Text className='browse-card-logic'>{a.summary.coreLogic}</Text>
                )}

                <Text className='browse-card-time'>
                  {new Date(r.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
