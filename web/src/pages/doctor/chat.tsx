/**
 * 医生助手 — 主聊天界面
 * 左侧 70% 聊天框，右侧 30% 实时引用面板，移动端折叠为抽屉
 * 支持流式输出 + Web Speech API 语音输入
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { Row, Col, Card, Input, Button, Spin, Typography, Empty, Drawer, Tooltip } from 'antd'
import { SendOutlined, RobotOutlined, FileTextOutlined, AudioOutlined } from '@ant-design/icons'
import { chatWithKnowledge, chatWithKnowledgeStream, getDoctorDatasets, type ChatReference } from '@/api/doctor'
import CitationCard from '@/components/CitationCard'

const { Text } = Typography

const QUICK_PROMPTS = [
  '糖尿病的最新治疗指南有哪些？',
  '高血压患者的用药建议',
  'COVID-19 疫苗的最新研究进展',
]

interface ChatMessage {
  role: string
  content: string
  references?: ChatReference[]
}

export default function DoctorChatPage() {
  const [datasetIds, setDatasetIds] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [refDrawerOpen, setRefDrawerOpen] = useState(false)
  const [currentRefs, setCurrentRefs] = useState<ChatReference[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getDoctorDatasets()
      .then(({ datasetIds: ids }) => setDatasetIds(ids))
      .catch(() => setDatasetIds([]))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (text?: string) => {
    const content = (text ?? inputValue).trim()
    if (!content) return
    if (datasetIds.length === 0) return

    setInputValue('')
    const userMsg: ChatMessage = { role: 'user', content }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    setCurrentRefs([])

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

    try {
      const streamMode = true
      if (streamMode) {
        const assistantMsg: ChatMessage = { role: 'assistant', content: '', references: [] }
        setMessages((prev) => [...prev, assistantMsg])
        for await (const ev of chatWithKnowledgeStream(datasetIds, history)) {
          if (ev.type === 'content' && ev.content) {
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, content: last.content + ev.content }
              }
              return next
            })
          } else if (ev.type === 'done' && ev.references) {
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, references: ev.references }
              }
              return next
            })
            setCurrentRefs(ev.references)
          } else if (ev.type === 'error') {
            setMessages((prev) => [
              ...prev.slice(0, -1),
              { role: 'assistant', content: `错误：${ev.error}` },
            ])
          }
        }
      } else {
        const { content: reply, references } = await chatWithKnowledge(datasetIds, history)
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: reply, references: references || [] },
        ])
        if (references?.length) setCurrentRefs(references)
      }
    } catch (e) {
      const errMsg = `错误：${e instanceof Error ? e.message : '请求失败'}`
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (streamMode && last?.role === 'assistant' && !last.content) {
          return [...prev.slice(0, -1), { ...last, content: errMsg }]
        }
        return [...prev, { role: 'assistant', content: errMsg }]
      })
    } finally {
      setLoading(false)
    }
  }

  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const toggleVoice = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const rec = new SpeechRecognitionAPI()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'zh-CN'
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const t = e.results[e.results.length - 1][0].transcript
      setInputValue((prev) => (prev ? `${prev} ${t}` : t))
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }, [listening])

  const lastAssistantRefs =
    [...messages].reverse().find((m) => m.role === 'assistant' && m.references?.length)?.references || []
  const displayRefs = currentRefs.length > 0 ? currentRefs : lastAssistantRefs

  return (
    <div style={{ padding: 16, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <Row gutter={16} style={{ flex: 1, minHeight: 0 }}>
        <Col xs={24} lg={17} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
              {datasetIds.length === 0 && (
                <Empty description="暂无可用知识库，请在知识库管理中创建或配置 RAGFLOW_MEDICAL_DATASET_ID" />
              )}
              {messages.length === 0 && datasetIds.length > 0 && (
                <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <RobotOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
                  <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                    基于医学文献的智能问答，每条回答均来自 RAG 检索，可溯源原文
                  </Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {QUICK_PROMPTS.map((q) => (
                      <Button key={q} size="small" type="default" onClick={() => handleSend(q)}>
                        {q}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
                      color: msg.role === 'user' ? '#fff' : '#333',
                    }}
                  >
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{msg.content}</div>
                    {msg.role === 'assistant' && msg.references && msg.references.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <FileTextOutlined /> 引用 {msg.references.length} 篇文献
                        </Text>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => {
                            setCurrentRefs(msg.references!)
                            setRefDrawerOpen(true)
                          }}
                          style={{ padding: '0 4px', fontSize: 12 }}
                        >
                          查看
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', marginBottom: 12 }}>
                  <div
                    style={{
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: '#f5f5f5',
                    }}
                  >
                    <Spin size="small" /> <Text type="secondary" style={{ marginLeft: 8 }}>检索文献中...</Text>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Input.TextArea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="输入医学问题，如：糖尿病的最新治疗指南？"
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <Tooltip title={typeof window !== 'undefined' && (window as any).SpeechRecognition ? '语音输入' : '当前浏览器不支持语音'}>
                  <Button
                    icon={<AudioOutlined />}
                    onClick={toggleVoice}
                    loading={listening}
                    type={listening ? 'primary' : 'default'}
                    style={{ minWidth: 44, minHeight: 44 }}
                  />
                </Tooltip>
              </div>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={loading}
                onClick={() => handleSend()}
                style={{ marginTop: 8 }}
              >
                发送
              </Button>
            </div>
          </Card>
        </Col>
        <Col xs={0} lg={7} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card
            title={
              <span>
                <FileTextOutlined /> 引用文献
              </span>
            }
            bodyStyle={{ overflowY: 'auto', flex: 1, minHeight: 0 }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            {displayRefs.length === 0 ? (
              <Empty description="回复后将展示引用文献" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              displayRefs.map((ref, i) => (
                <CitationCard
                  key={i}
                  documentName={ref.documentName}
                  content={ref.content}
                  similarity={ref.similarity}
                />
              ))
            )}
          </Card>
        </Col>
      </Row>
      <Drawer
        title="引用文献"
        placement="right"
        open={refDrawerOpen}
        onClose={() => setRefDrawerOpen(false)}
        width="90%"
      >
        {displayRefs.map((ref, i) => (
          <CitationCard
            key={i}
            documentName={ref.documentName}
            content={ref.content}
            similarity={ref.similarity}
          />
        ))}
      </Drawer>
    </div>
  )
}
