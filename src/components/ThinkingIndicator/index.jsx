import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import './index.scss'

export default function ThinkingIndicator() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s < 2 ? s + 1 : s))
    }, 800)
    return () => clearInterval(timer)
  }, [])

  const steps = [
    { icon: '📡', text: '理解问题' },
    { icon: '📊', text: '检索数据' },
    { icon: '📝', text: '生成分析' },
  ]

  return (
    <View className="think-row">
      <View className="think-avatar">
        <Text className="think-avatar-char">问</Text>
      </View>
      <View className="think-card">
        <Text className="think-title">正在深度分析...</Text>
        <View className="think-steps">
          {steps.map((s, i) => (
            <View key={i} className={`think-step ${i <= step ? 'done' : ''}`}>
              <Text className="think-step-icon">{s.icon}</Text>
              <Text className="think-step-text">{s.text}</Text>
              {i <= step && <Text className="think-step-check">✓</Text>}
            </View>
          ))}
        </View>
        <View className="think-dots">
          <View className="think-dot" />
          <View className="think-dot" />
          <View className="think-dot" />
        </View>
      </View>
    </View>
  )
}
