import { View, Text } from '@tarojs/components'
import './index.scss'

/**
 * 模型选择器 - 用于设置页切换模型
 * 具体选项与选中逻辑由父组件传入
 */
export default function ModelSelector({ options = [], value, onChange }) {
  return (
    <View className="model-selector">
      {options.map((opt) => (
        <View
          key={opt.id}
          className={`model-selector-item ${value === opt.id ? 'active' : ''}`}
          onClick={() => onChange?.(opt.id)}
        >
          <Text className="model-selector-label">{opt.name}</Text>
        </View>
      ))}
    </View>
  )
}
