import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import ChatBubble from '@/components/ChatBubble'
import InputBar from '@/components/InputBar'
import PromptTags from '@/components/PromptTags'
import ThinkingIndicator from '@/components/ThinkingIndicator'
import { getChatService } from '@/services/chat/ChatService'
import { getModelService } from '@/services/model/ModelService'
import { PROMPT_TEMPLATES } from '@/constants/prompts'
import './index.scss'

const PREFILL_MAP = {
  MARKET_TREND: 'marketTrend',
  TREND_FORECAST: 'trendForecast',
  TRADE_SIGNAL: 'tradeSignal',
  STOCK_PICK: 'stockPick',
  INDUSTRY_ANALYSIS: 'industryAnalysis',
}

export default function Chat() {
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [modelName, setModelName] = useState('')
  const [thinking, setThinking] = useState(false)
  const chatService = getChatService()

  useEffect(() => {
    chatService.loadHistory()
    chatService.setOnUpdate((msgs) => {
      setMessages([...msgs])
      const isLoading = msgs.some((m) => m.loading)
      setSending(isLoading)
      setThinking(isLoading)
    })
    setMessages(chatService.getMessages())
    const ms = getModelService()
    setModelName(ms.getProvider().name)

    const prefill = router.params?.prefill
    if (prefill) {
      const decoded = decodeURIComponent(prefill)
      const templateKey = PREFILL_MAP[decoded]
      if (templateKey && PROMPT_TEMPLATES[templateKey]) {
        setTimeout(() => handleSend(PROMPT_TEMPLATES[templateKey].prompt), 300)
      } else {
        setTimeout(() => handleSend(decoded), 300)
      }
    }

    return () => chatService.setOnUpdate(null)
  }, [])

  const handleSend = (content) => {
    if (sending) return
    chatService.send(content)
  }

  const handleTagClick = (tagKey) => {
    if (sending) return
    const tpl = PROMPT_TEMPLATES[tagKey]
    if (tpl) handleSend(tpl.prompt)
  }

  const handleClear = () => {
    Taro.showModal({
      title: '清空对话',
      content: '确定要清空所有对话记录吗？',
      success: (res) => {
        if (res.confirm) chatService.clear()
      }
    })
  }

  return (
    <View className="chat-page">
      <View className="chat-header">
        <Text className="chat-header-model">{modelName}</Text>
        {messages.length > 0 && (
          <Text className="chat-header-clear" onClick={handleClear}>清空</Text>
        )}
      </View>

      <ScrollView className="chat-list" scrollY scrollWithAnimation>
        {messages.length === 0 ? (
          <View className="chat-empty">
            <View className="chat-empty-avatar">
              <Text className="chat-empty-avatar-text">问</Text>
            </View>
            <Text className="chat-empty-title">有问题，尽管问...</Text>
            <Text className="chat-empty-hint">支持大势研判、选股、行业分析等</Text>
          </View>
        ) : (
          <>
            {messages.map((msg, i) => (
              <View key={i}>
                {msg.loading && msg.role === 'assistant' && <ThinkingIndicator />}
                {!msg.loading && (
                  <ChatBubble
                    role={msg.role}
                    content={msg.content}
                    loading={msg.loading}
                    error={msg.error}
                    onRetry={
                      msg.error && msg.role === 'assistant'
                        ? () => chatService.retryFailed(i)
                        : undefined
                    }
                  />
                )}
              </View>
            ))}
            <View style={{ height: '20rpx' }} />
          </>
        )}
      </ScrollView>

      <View className="chat-bottom">
        <PromptTags onSelect={handleTagClick} disabled={sending} />
        <InputBar onSend={handleSend} disabled={sending} />
      </View>
    </View>
  )
}
