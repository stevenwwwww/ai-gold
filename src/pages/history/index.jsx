import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getHistoryService } from '@/services/history/HistoryService'
import { usePageTheme } from '@/components/ThemeProvider'
import './index.scss'

export default function History() {
  const tc = usePageTheme()
  const [sessions, setSessions] = useState([])

  useEffect(() => { loadSessions() }, [])

  const loadSessions = async () => {
    const list = await getHistoryService().getSessions()
    setSessions(list)
  }

  const handleOpen = (id) => {
    Taro.navigateTo({ url: `/pages/chat/index?sessionId=${id}` })
  }

  const handleDelete = (id) => {
    Taro.showModal({
      title: '删除',
      content: '确定删除这条对话记录？',
      success: async (res) => {
        if (res.confirm) {
          await getHistoryService().deleteSession(id)
          loadSessions()
        }
      }
    })
  }

  const handleClearAll = () => {
    Taro.showModal({
      title: '清空',
      content: '确定清空所有对话历史？',
      success: async (res) => {
        if (res.confirm) {
          await getHistoryService().clearAll()
          setSessions([])
        }
      }
    })
  }

  return (
    <View className={`history-page ${tc}`}>
      {sessions.length > 0 && (
        <View className="history-toolbar">
          <Text className="history-count">{sessions.length} 条对话</Text>
          <Text className="history-clear-all" onClick={handleClearAll}>清空全部</Text>
        </View>
      )}
      <ScrollView scrollY className="history-scroll">
        {sessions.length === 0 ? (
          <View className="history-empty">
            <Text className="history-empty-icon">💬</Text>
            <Text className="history-empty-text">暂无对话历史</Text>
          </View>
        ) : (
          sessions.map((s) => (
            <View key={s.id} className="history-card" onClick={() => handleOpen(s.id)}>
              <View className="history-card-top">
                <Text className="history-card-title">{s.title}</Text>
                <Text className="history-card-delete" onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}>删除</Text>
              </View>
              <View className="history-card-meta">
                <Text className="history-card-count">{s.messages?.length || 0} 条消息</Text>
                <Text className="history-card-time">{new Date(s.updatedAt).toLocaleString()}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
