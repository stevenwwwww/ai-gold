import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { reportService } from '@/services/report/ReportService'
import { usePageTheme } from '@/components/ThemeProvider'
import './index.scss'

const QUICK_PROMPTS = [
  '这份研报的核心逻辑是什么？',
  '公司的竞争优势在哪里？',
  '财务数据有什么异常吗？',
  '主要风险有哪些？'
]

export default function ReportChat() {
  const router = useRouter()
  const tc = usePageTheme()
  const [reportId, setReportId] = useState('')
  const [title, setTitle] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    const id = router.params?.id
    if (!id) return
    setReportId(id)

    reportService.getReport(id)
      .then((r) => setTitle(r.title))
      .catch(() => {})

    reportService.getChatHistory(id)
      .then((history) => {
        if (history.length > 0) {
          setMessages(history.map((m) => ({ role: m.role, content: m.content })))
          setScrollTop((prev) => prev + 1)
        }
      })
      .catch(() => {})
  }, [router.params?.id])

  const sendMessage = useCallback(
    async (content) => {
      if (!reportId || !content?.trim() || sending) return

      const userMsg = { role: 'user', content: content.trim() }
      setInput('')
      setSending(true)

      setMessages((prev) => {
        const updated = [...prev, userMsg]
        setScrollTop((s) => s + 1)

        reportService.chat(reportId, updated)
          .then((res) => {
            setMessages((p) => [...p, { role: 'assistant', content: res }])
            setScrollTop((s) => s + 1)
          })
          .catch((e) => {
            const errMsg = e instanceof Error ? e.message : '未知错误'
            setMessages((p) => [...p, { role: 'assistant', content: `错误: ${errMsg}` }])
            setScrollTop((s) => s + 1)
          })
          .finally(() => setSending(false))

        return updated
      })
    },
    [reportId, sending]
  )

  if (!reportId) {
    return (
      <View className={`report-chat ${tc}`}>
        <View className="report-chat-empty">
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className={`report-chat ${tc}`}>
      <View className="report-chat-header">
        <Text className="report-chat-title">{title || '研报问答'}</Text>
        <Text className="report-chat-hint">基于研报内容回答，不编造信息</Text>
      </View>

      <ScrollView
        scrollY
        className="report-chat-messages"
        scrollTop={scrollTop * 99999}
        scrollWithAnimation
      >
        {messages.length === 0 && !sending && (
          <View className="report-chat-quick">
            <Text className="report-chat-quick-title">快速提问</Text>
            {QUICK_PROMPTS.map((p, i) => (
              <View
                key={i}
                className="report-chat-quick-item"
                onClick={() => sendMessage(p)}
              >
                <Text>{p}</Text>
              </View>
            ))}
          </View>
        )}

        {messages.map((msg, i) => (
          <View
            key={i}
            className={`report-chat-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}
          >
            <Text className="report-chat-bubble-role">
              {msg.role === 'user' ? '我' : 'AI'}
            </Text>
            <Text className="report-chat-bubble-text" selectable>
              {msg.content}
            </Text>
          </View>
        ))}

        {sending && (
          <View className="report-chat-bubble ai">
            <Text className="report-chat-bubble-role">AI</Text>
            <Text className="report-chat-bubble-text">思考中...</Text>
          </View>
        )}

        <View className="report-chat-spacer" />
      </ScrollView>

      <View className="report-chat-footer">
        <View className="report-chat-input-wrap">
          <Input
            className="report-chat-input"
            placeholder="输入问题..."
            value={input}
            onInput={(e) => setInput(e.detail?.value || '')}
          />
          <View
            className={`report-chat-send ${input.trim() && !sending ? 'active' : ''}`}
            onClick={() => sendMessage(input)}
          >
            <Text>发送</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
