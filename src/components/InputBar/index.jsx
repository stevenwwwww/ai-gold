import { View, Input } from '@tarojs/components'
import { useState } from 'react'
import './index.scss'

export default function InputBar({ onSend, disabled }) {
  const [value, setValue] = useState('')

  const handleSend = () => {
    if (disabled) return
    if (value?.trim()) {
      onSend?.(value)
      setValue('')
    }
  }

  return (
    <View className="input-bar">
      <View className="input-bar-inner">
        <Input
          className="input-bar-input"
          placeholder={disabled ? 'AI 正在分析中...' : '有问题，尽管问...'}
          placeholderClass="input-placeholder"
          value={value}
          disabled={disabled}
          onInput={(e) => setValue(e.detail.value)}
          confirmType="send"
          onConfirm={handleSend}
        />
        <View
          className={`input-bar-send ${value?.trim() && !disabled ? 'active' : ''}`}
          onClick={handleSend}
        >
          <View className="send-arrow" />
        </View>
      </View>
    </View>
  )
}
