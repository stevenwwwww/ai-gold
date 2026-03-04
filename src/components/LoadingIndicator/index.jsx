import { View } from '@tarojs/components'
import './index.scss'

export default function LoadingIndicator() {
  return (
    <View className="typing-indicator">
      <View className="typing-dot" />
      <View className="typing-dot" />
      <View className="typing-dot" />
    </View>
  )
}
