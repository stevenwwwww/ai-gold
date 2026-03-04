import { View, Text } from '@tarojs/components'
import MiniChart from '@/components/MiniChart'
import DataTable from '@/components/DataTable'
import { parseContent } from '@/utils/contentParser'
import './index.scss'

export default function ChatBubble({ role, content, loading, error, onRetry }) {
  const isUser = role === 'user'
  const segments = isUser ? null : parseContent(content)

  const formatUserContent = (text) => {
    if (!text) return ''
    if (text.length > 80) return text.slice(0, 60) + '...'
    return text
  }

  return (
    <View className={`msg-wrap ${isUser ? 'is-user' : 'is-ai'}`}>
      {!isUser && (
        <View className="msg-avatar">
          <Text className="msg-avatar-text">问</Text>
        </View>
      )}
      <View className={`msg-bubble ${isUser ? 'msg-user' : 'msg-ai'} ${error ? 'msg-error' : ''}`}>
        {error ? (
          <View className="msg-error-wrap">
            <Text className="msg-error-text">请求失败，请重试</Text>
            {onRetry && (
              <Text className="msg-retry-btn" onClick={onRetry}>🔄 重试</Text>
            )}
          </View>
        ) : isUser ? (
          <Text className="msg-text" selectable>{formatUserContent(content)}</Text>
        ) : (
          <View className="msg-rich-content">
            {segments && segments.map((seg, i) => {
              if (seg.type === 'chart' && seg.data) {
                return (
                  <MiniChart
                    key={i}
                    title={seg.data.title}
                    data={seg.data.data}
                    labels={seg.data.labels}
                    color={seg.data.color || 'auto'}
                  />
                )
              }
              if (seg.type === 'table' && seg.data) {
                return (
                  <DataTable
                    key={i}
                    title={seg.data.title}
                    columns={seg.data.columns}
                    data={seg.data.data}
                  />
                )
              }
              return <Text key={i} className="msg-text" selectable>{seg.content}</Text>
            })}
          </View>
        )}
      </View>
    </View>
  )
}
