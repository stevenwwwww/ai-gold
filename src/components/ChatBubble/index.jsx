import { View, Text } from '@tarojs/components'
import MiniChart from '@/components/MiniChart'
import DataTable from '@/components/DataTable'
import { parseContent } from '@/utils/contentParser'
import './index.scss'

export default function ChatBubble({ role, content, error, onRetry }) {
  const isUser = role === 'user'
  const segments = isUser ? null : parseContent(content)

  return (
    <View className={`bubble-row ${isUser ? 'bubble-user' : 'bubble-ai'}`}>
      <View className={`bubble-avatar ${isUser ? 'bubble-avatar-user' : ''}`}>
        <Text className="bubble-avatar-char">{isUser ? '我' : '问'}</Text>
      </View>
      <View className={`bubble-body ${isUser ? 'bubble-body-user' : 'bubble-body-ai'} ${error ? 'bubble-body-error' : ''}`}>
        {error ? (
          <View className="bubble-error">
            <Text className="bubble-error-msg">分析失败，请重试</Text>
            {onRetry && (
              <View className="bubble-retry" onClick={onRetry}>
                <Text className="bubble-retry-text">🔄 重试</Text>
              </View>
            )}
          </View>
        ) : isUser ? (
          <Text className="bubble-text" selectable>{content}</Text>
        ) : (
          <View className="bubble-rich">
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
              return (
                <Text key={i} className="bubble-text" selectable>{seg.content}</Text>
              )
            })}
          </View>
        )}
      </View>
    </View>
  )
}
