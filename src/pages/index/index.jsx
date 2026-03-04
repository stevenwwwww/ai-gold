import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getNewsService } from '@/services/news/NewsService'
import { getHistoryService } from '@/services/history/HistoryService'
import { useTheme, usePageTheme } from '@/components/ThemeProvider'
import { themeService } from '@/services/theme/ThemeService'
import './index.scss'

export default function Index() {
  const { isDark } = useTheme()
  const tc = usePageTheme()
  const [newsList, setNewsList] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [news, hist] = await Promise.all([
        getNewsService().fetchHotNews(),
        getHistoryService().getSessions()
      ])
      setNewsList(news || [])
      setSessions((hist || []).slice(0, 5))
    } catch (e) { console.warn('[Index]', e) }
    setLoading(false)
  }

  const goChat = (prefill) => {
    Taro.navigateTo({
      url: prefill
        ? `/pages/chat/index?prefill=${encodeURIComponent(prefill)}`
        : '/pages/chat/index'
    })
  }

  const goChatSession = (sid) => {
    Taro.navigateTo({ url: `/pages/chat/index?sessionId=${sid}` })
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 9) return '早盘前好'
    if (h < 12) return '上午好'
    if (h < 13) return '午间好'
    if (h < 15) return '下午好'
    if (h < 18) return '盘后好'
    return '晚上好'
  }

  return (
    <View className={`hp ${tc}`}>
      <View className="hp-bar">
        <View className="hp-bar-l">
          <Text className="hp-bar-menu">☰</Text>
        </View>
        <Text className="hp-bar-title">问股AI</Text>
        <View className="hp-bar-r">
          <Text className="hp-bar-icon" onClick={() => themeService.toggle()}>
            {isDark ? '☀️' : '🌙'}
          </Text>
          <Text className="hp-bar-icon" onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}>📋</Text>
          <Text className="hp-bar-icon" onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>⚙️</Text>
        </View>
      </View>

      <ScrollView scrollY className="hp-body">
        {/* 问候区 - 仿问财风格 */}
        <View className="hp-greet">
          <View className="hp-greet-avatar">
            <Text className="hp-greet-avatar-t">问</Text>
          </View>
          <View className="hp-greet-info">
            <Text className="hp-greet-h">{getGreeting()}，我是问股</Text>
            <Text className="hp-greet-p">我是你的智能投顾助理，我为你准备了以下可能对你有帮助的话题：</Text>
          </View>
        </View>

        {/* 热点新闻卡片 */}
        <View className="hp-sec">
          <View className="hp-sec-head">
            <Text className="hp-sec-title">热点讨论、热点突发</Text>
          </View>
          <Text className="hp-sec-sub">全网热议！你关心的问题都在这里！</Text>

          {loading ? (
            <View className="hp-loading">
              <View className="hp-loading-bar" />
              <Text className="hp-loading-t">正在获取热点...</Text>
            </View>
          ) : (
            <View className="hp-news">
              {newsList.map((item, i) => (
                <View
                  key={item.id}
                  className="hp-news-item"
                  onClick={() => goChat(`请分析以下新闻对A股市场的影响：\n${item.title}`)}
                >
                  <Text className={`hp-news-num ${i < 3 ? 'hot' : ''}`}>{i + 1}</Text>
                  <Text className="hp-news-text">{item.title}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 智能分析 */}
        <View className="hp-sec">
          <Text className="hp-sec-title">智能分析</Text>
          <View className="hp-tags">
            {[
              { k: 'MARKET_TREND', icon: '📊', label: '大势研判', sub: '全局走势' },
              { k: 'TREND_FORECAST', icon: '📈', label: '走势预测', sub: '趋势分析' },
              { k: 'TRADE_SIGNAL', icon: '⚡', label: '买卖研判', sub: '买卖信号' },
              { k: 'STOCK_PICK', icon: '🔍', label: '选股票', sub: '精选推荐' },
              { k: 'INDUSTRY_ANALYSIS', icon: '🏭', label: '行业分析', sub: '板块轮动' },
            ].map((t) => (
              <View key={t.k} className="hp-tag" onClick={() => goChat(t.k)}>
                <Text className="hp-tag-icon">{t.icon}</Text>
                <View className="hp-tag-info">
                  <Text className="hp-tag-label">{t.label}</Text>
                  <Text className="hp-tag-sub">{t.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 最近对话 */}
        {sessions.length > 0 && (
          <View className="hp-sec">
            <View className="hp-sec-head">
              <Text className="hp-sec-title">最近对话</Text>
              <Text className="hp-sec-more" onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}>查看全部 ›</Text>
            </View>
            {sessions.map((s) => (
              <View key={s.id} className="hp-hist-item" onClick={() => goChatSession(s.id)}>
                <View className="hp-hist-dot" />
                <View className="hp-hist-mid">
                  <Text className="hp-hist-title">{s.title}</Text>
                </View>
                <Text className="hp-hist-time">{new Date(s.updatedAt).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
        )}

        {/* CTA */}
        <View className="hp-cta" onClick={() => goChat()}>
          <Text className="hp-cta-t">有问题，尽管问...</Text>
          <View className="hp-cta-btn">
            <Text className="hp-cta-btn-t">›</Text>
          </View>
        </View>

        <Text className="hp-disclaimer">内容由AI生成，不构成投资建议</Text>
      </ScrollView>
    </View>
  )
}
