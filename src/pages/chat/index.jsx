import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useRef, useCallback } from 'react'
import ChatBubble from '@/components/ChatBubble'
import InputBar from '@/components/InputBar'
import PromptTags from '@/components/PromptTags'
import ThinkingIndicator from '@/components/ThinkingIndicator'
import { createChatService } from '@/services/chat/ChatService'
import { getModelService } from '@/services/model/ModelService'
import { PROMPT_TEMPLATES } from '@/constants/prompts'
import { usePageTheme } from '@/components/ThemeProvider'
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
  const tc = usePageTheme()
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [modelName, setModelName] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const chatServiceRef = useRef(null)

  useEffect(() => {
    const sessionId = router.params?.sessionId
    const svc = createChatService()
    chatServiceRef.current = svc

    svc.setOnUpdate((msgs) => {
      setMessages([...msgs])
      setSending(msgs.some((m) => m.loading))
      setScrollTop((prev) => prev + 1)
    })

    if (sessionId) {
      svc.loadSession(sessionId)
    }

    const ms = getModelService()
    setModelName(ms.getProvider().name)

    const prefill = router.params?.prefill
    if (prefill && !sessionId) {
      const decoded = decodeURIComponent(prefill)
      const templateKey = PREFILL_MAP[decoded]
      if (templateKey && PROMPT_TEMPLATES[templateKey]) {
        setTimeout(() => handleSend(PROMPT_TEMPLATES[templateKey].prompt), 300)
      } else {
        setTimeout(() => handleSend(decoded), 300)
      }
    }

    return () => {
      if (chatServiceRef.current) chatServiceRef.current.setOnUpdate(null)
    }
  }, [])

  const handleSend = useCallback((content) => {
    if (sending || !chatServiceRef.current) return
    chatServiceRef.current.send(content)
  }, [sending])

  const handleTagClick = useCallback((tagKey) => {
    if (sending) return
    const tpl = PROMPT_TEMPLATES[tagKey]
    if (tpl) handleSend(tpl.prompt)
  }, [sending, handleSend])

  const handleClear = () => {
    Taro.showModal({
      title: '新建对话',
      content: '将清空当前对话并开始新会话',
      success: (res) => {
        if (res.confirm && chatServiceRef.current) {
          chatServiceRef.current.clear()
          chatServiceRef.current = createChatService()
          chatServiceRef.current.setOnUpdate((msgs) => {
            setMessages([...msgs])
            setSending(msgs.some((m) => m.loading))
          })
          setMessages([])
        }
      }
    })
  }

  return (
    <View className={`chat-page ${tc}`}>
      <View className="chat-topbar">
        <View className="chat-topbar-left" onClick={() => Taro.navigateBack()}>
          <Text className="chat-back-icon">‹</Text>
        </View>
        <View className="chat-topbar-center">
          <Text className="chat-topbar-model">{modelName}</Text>
        </View>
        {/* <View className="chat-topbar-right">
          <Text className="chat-topbar-action" onClick={handleClear}>+ 新对话</Text>
        </View> */}
      </View>

      <ScrollView
        className="chat-messages"
        scrollY
        scrollWithAnimation
        scrollTop={scrollTop * 99999}
      >
        {messages.length === 0 ? (
          <View className="chat-welcome">
            <View className="chat-welcome-avatar">
              <Text className="chat-welcome-avatar-text">问</Text>
            </View>
            <Text className="chat-welcome-title">有问题，尽管问</Text>
            <Text className="chat-welcome-sub">支持大势研判 · 选股 · 行业分析 · 走势预测</Text>
          </View>
        ) : (
          <View className="chat-msg-list">
            {messages.map((msg, i) => (
              <View key={i} className="chat-msg-item">
                {msg.loading && msg.role === 'assistant' && <ThinkingIndicator />}
                {!msg.loading && (
                  <ChatBubble
                    role={msg.role}
                    content={msg.content}
                    error={msg.error}
                    onRetry={
                      msg.error && msg.role === 'assistant'
                        ? () => chatServiceRef.current?.retryFailed(i)
                        : undefined
                    }
                  />
                )}
              </View>
            ))}
            <View className="chat-msg-bottom-spacer" />
          </View>
        )}
      </ScrollView>

      <View className="chat-footer">
        <PromptTags onSelect={handleTagClick} disabled={sending} />
        <InputBar onSend={handleSend} disabled={sending} />
        <View className="chat-disclaimer-bar">
          <Text className="chat-disclaimer-text">内容由AI生成，不构成投资建议</Text>
        </View>
      </View>
    </View>
  )
}
