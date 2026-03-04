import { View, Text } from '@tarojs/components'
import './index.scss'

export default function ThinkingIndicator() {
  return (
    <View className="thinking-wrap">
      <View className="thinking-avatar">
        <Text className="thinking-avatar-text">问</Text>
      </View>
      <View className="thinking-bubble">
        <View className="thinking-header">
          <Text className="thinking-label">🧠 正在分析中...</Text>
        </View>
        <View className="thinking-steps">
          <Text className="thinking-step active">📡 理解问题</Text>
          <Text className="thinking-step active">📊 检索数据</Text>
          <Text className="thinking-step">📝 生成分析</Text>
        </View>
        <View className="thinking-dots">
          <View className="thinking-dot" />
          <View className="thinking-dot" />
          <View className="thinking-dot" />
        </View>
      </View>
    </View>
  )
}
