import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getModelService } from '@/services/model/ModelService'
import './index.scss'

export default function Settings() {
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
    Taro.showToast({ title: '已切换模型', icon: 'success', duration: 1000 })
  }

  return (
    <View className="settings-page">
      <View className="settings-section">
        <Text className="settings-section-title">智能调度</Text>
        <Text className="settings-section-sub">选择分析引擎</Text>
        <View className="settings-models">
          {providers.map((p) => {
            const isActive = selectedModel === p.id
            return (
              <View
                key={p.id}
                className={`settings-model-card ${isActive ? 'active' : ''}`}
                onClick={() => handleSelect(p.id)}
              >
                <View className="settings-model-left">
                  <View className={`settings-model-dot ${isActive ? 'dot-active' : ''}`} />
                  <View className="settings-model-info">
                    <Text className="settings-model-name">{p.name}</Text>
                    <Text className="settings-model-desc">
                      {p.id === 'qwen' ? '通义千问，综合分析能力强' : '深度推理，逻辑分析专长'}
                    </Text>
                  </View>
                </View>
                {isActive && <Text className="settings-model-check">✓</Text>}
              </View>
            )
          })}
        </View>
      </View>

      <View className="settings-section">
        <Text className="settings-section-title">关于</Text>
        <View className="settings-about">
          <View className="settings-about-row">
            <Text className="settings-about-label">版本</Text>
            <Text className="settings-about-value">1.0.0</Text>
          </View>
          <View className="settings-about-row">
            <Text className="settings-about-label">框架</Text>
            <Text className="settings-about-value">Taro + React</Text>
          </View>
          <View className="settings-about-row no-border">
            <Text className="settings-about-label">数据说明</Text>
            <Text className="settings-about-value">AI生成，不构成投资建议</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
