import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getNewsService } from '@/services/news/NewsService'
import { getHistoryService } from '@/services/history/HistoryService'
import './index.scss'

export default function Index() {
  const [newsList, setNewsList] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [news, hist] = await Promise.all([
        getNewsService().fetchHotNews(),
        getHistoryService().getSessions()
      ])
      setNewsList(news || [])
      setSessions((hist || []).slice(0, 5))
    } catch (e) {
      console.warn('[Index] loadData error:', e)
    }
    setLoading(false)
  }

  const goToChat = (prefill) => {
    const url = prefill
      ? `/pages/chat/index?prefill=${encodeURIComponent(prefill)}`
      : '/pages/chat/index'
    Taro.navigateTo({ url })
  }

  const goToSettings = () => {
    Taro.navigateTo({ url: '/pages/settings/index' })
  }

  const goToHistory = () => {
    Taro.navigateTo({ url: '/pages/history/index' })
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 9) return '早盘前好'
    if (h < 11.5) return '上午好'
    if (h < 13) return '午间好'
    if (h < 15) return '下午好'
    if (h < 18) return '盘后好'
    return '晚上好'
  }

  return (
    <View className="home-page">
      <View className="home-header">
        <View className="home-header-left">
          <View className="home-avatar">
            <Text className="home-avatar-text">问</Text>
          </View>
          <View className="home-greeting">
            <Text className="home-greeting-hi">{getGreeting()}，我是问股AI</Text>
            <Text className="home-greeting-sub">你的智能投顾助理，为你准备了以下热点</Text>
          </View>
        </View>
        <View className="home-header-right">
          <Text className="home-icon-btn" onClick={goToHistory}>📋</Text>
          <Text className="home-icon-btn" onClick={goToSettings}>⚙️</Text>
        </View>
      </View>

      <ScrollView scrollY className="home-body">
        <View className="home-section">
          <View className="home-section-header">
            <Text className="home-section-title">🔥 热点讨论</Text>
            <Text className="home-section-sub">影响股市的热点事件</Text>
          </View>
          <View className="home-news-list">
            {loading ? (
              <View className="home-news-loading">
                <Text className="home-news-loading-text">加载中...</Text>
              </View>
            ) : newsList.length === 0 ? (
              <Text className="home-news-empty">暂无热点</Text>
            ) : (
              newsList.map((item, i) => (
                <View
                  key={item.id}
                  className="home-news-item"
                  onClick={() => goToChat(`请分析以下新闻对A股市场的影响：\n${item.title}`)}
                >
                  <Text className={`home-news-rank ${i < 3 ? 'hot' : ''}`}>{i + 1}</Text>
                  <Text className="home-news-title">{item.title}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View className="home-section">
          <Text className="home-section-title">⚡ 快速分析</Text>
          <View className="home-quick-tags">
            <View className="home-quick-tag" onClick={() => goToChat('MARKET_TREND')}>
              <Text className="home-quick-tag-icon">📊</Text>
              <Text className="home-quick-tag-label">大势研判</Text>
            </View>
            <View className="home-quick-tag" onClick={() => goToChat('TREND_FORECAST')}>
              <Text className="home-quick-tag-icon">📈</Text>
              <Text className="home-quick-tag-label">走势预测</Text>
            </View>
            <View className="home-quick-tag" onClick={() => goToChat('TRADE_SIGNAL')}>
              <Text className="home-quick-tag-icon">⚡</Text>
              <Text className="home-quick-tag-label">买卖研判</Text>
            </View>
            <View className="home-quick-tag" onClick={() => goToChat('STOCK_PICK')}>
              <Text className="home-quick-tag-icon">🔍</Text>
              <Text className="home-quick-tag-label">选股票</Text>
            </View>
            <View className="home-quick-tag" onClick={() => goToChat('INDUSTRY_ANALYSIS')}>
              <Text className="home-quick-tag-icon">🏭</Text>
              <Text className="home-quick-tag-label">行业分析</Text>
            </View>
          </View>
        </View>

        {sessions.length > 0 && (
          <View className="home-section">
            <View className="home-section-header">
              <Text className="home-section-title">💬 最近对话</Text>
              <Text className="home-section-more" onClick={goToHistory}>查看全部</Text>
            </View>
            {sessions.map((s) => (
              <View key={s.id} className="home-session-item" onClick={() => goToChat()}>
                <Text className="home-session-title">{s.title}</Text>
                <Text className="home-session-time">
                  {new Date(s.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="home-start-btn" onClick={() => goToChat()}>
          <Text className="home-start-btn-text">开始提问</Text>
        </View>

        <View className="home-disclaimer">
          <Text className="home-disclaimer-text">内容由AI生成，不构成投资建议</Text>
        </View>
      </ScrollView>
    </View>
  )
}
