import { View, Input, Text } from '@tarojs/components'
import { useState } from 'react'
import './index.scss'

export default function InputBar({ onSend, disabled }) {
  const [value, setValue] = useState('')

  const handleSend = () => {
    if (disabled || !value?.trim()) return
    onSend?.(value)
    setValue('')
  }

  return (
    <View className="ibar">
      <View className="ibar-inner">
        <Input
          className="ibar-input"
          placeholder={disabled ? 'AI 正在分析中...' : '有问题，尽管问...'}
          placeholderClass="ibar-placeholder"
          value={value}
          disabled={disabled}
          onInput={(e) => setValue(e.detail.value)}
          confirmType="send"
          onConfirm={handleSend}
        />
        <View className="ibar-extra">
          <Text className="ibar-plus">+</Text>
        </View>
        <View
          className={`ibar-send ${value?.trim() && !disabled ? 'ibar-send-active' : ''}`}
          onClick={handleSend}
        >
          <View className="ibar-arrow" />
        </View>
      </View>
    </View>
  )
}
