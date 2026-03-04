import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getHistoryService } from '@/services/history/HistoryService'
import './index.scss'

export default function History() {
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    const list = await getHistoryService().getSessions()
    setSessions(list)
  }

  const handleClearAll = () => {
    Taro.showModal({
      title: '清空历史',
      content: '确定要清空所有对话历史吗？',
      success: async (res) => {
        if (res.confirm) {
          await getHistoryService().clearAll()
          setSessions([])
        }
      }
    })
  }

  return (
    <View className="history-page">
      <View className="history-header">
        <Text className="history-title">对话历史</Text>
        {sessions.length > 0 && (
          <Text className="history-clear" onClick={handleClearAll}>清空</Text>
        )}
      </View>
      <ScrollView scrollY className="history-list">
        {sessions.length === 0 ? (
          <View className="history-empty">
            <Text className="history-empty-text">暂无对话历史</Text>
          </View>
        ) : (
          sessions.map((s) => (
            <View key={s.id} className="history-item">
              <Text className="history-item-title">{s.title}</Text>
              <Text className="history-item-count">{s.messages?.length || 0} 条消息</Text>
              <Text className="history-item-time">
                {new Date(s.updatedAt).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
