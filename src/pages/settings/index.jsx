import { View, Text, Switch } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getModelService } from '@/services/model/ModelService'
import { useTheme, usePageTheme } from '@/components/ThemeProvider'
import { themeService } from '@/services/theme/ThemeService'
import './index.scss'

export default function Settings() {
  const { isDark } = useTheme()
  const tc = usePageTheme()
  const modelService = getModelService()
  const [selectedModel, setSelectedModel] = useState(modelService.currentProviderId)
  const [providers, setProviders] = useState([])

  useEffect(() => {
    const list = modelService.getAvailableProviders()
    setProviders(list.filter((p) => p.id !== 'local'))
  }, [])

  const handleSelect = (id) => {
    modelService.setCurrentProvider(id)
    setSelectedModel(id)
    Taro.showToast({ title: '已切换', icon: 'success', duration: 1000 })
  }

  return (
    <View className={`settings-page ${tc}`}>
      <View className="settings-card">
        <Text className="settings-card-title">外观</Text>
        <View className="settings-row">
          <View className="settings-row-left">
            <Text className="settings-row-icon">{isDark ? '🌙' : '☀️'}</Text>
            <View className="settings-row-info">
              <Text className="settings-row-label">暗黑模式</Text>
              <Text className="settings-row-desc">切换明亮/暗黑主题</Text>
            </View>
          </View>
          <Switch checked={isDark} onChange={() => themeService.toggle()} color="#E63946" />
        </View>
      </View>

      <View className="settings-card">
        <Text className="settings-card-title">分析引擎</Text>
        <Text className="settings-card-desc">选择AI分析模型</Text>
        {providers.map((p) => {
          const isActive = selectedModel === p.id
          return (
            <View
              key={p.id}
              className={`settings-model ${isActive ? 'active' : ''}`}
              onClick={() => handleSelect(p.id)}
            >
              <View className="settings-model-left">
                <View className={`settings-radio ${isActive ? 'checked' : ''}`}>
                  {isActive && <View className="settings-radio-dot" />}
                </View>
                <View className="settings-model-info">
                  <Text className="settings-model-name">{p.name}</Text>
                  <Text className="settings-model-detail">
                    {p.id === 'qwen' ? '综合分析能力强，响应快速' : '深度推理，逻辑分析专长'}
                  </Text>
                </View>
              </View>
              {isActive && <Text className="settings-check-icon">✓</Text>}
            </View>
          )
        })}
      </View>

      <View className="settings-card">
        <Text className="settings-card-title">关于</Text>
        <View className="settings-info-row">
          <Text className="settings-info-label">版本</Text>
          <Text className="settings-info-value">1.0.0</Text>
        </View>
        <View className="settings-info-row">
          <Text className="settings-info-label">框架</Text>
          <Text className="settings-info-value">Taro + React</Text>
        </View>
        <View className="settings-info-row last">
          <Text className="settings-info-label">声明</Text>
          <Text className="settings-info-value">AI生成内容不构成投资建议</Text>
        </View>
      </View>
    </View>
  )
}
