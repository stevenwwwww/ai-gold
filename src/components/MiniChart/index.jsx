import { View, Text } from '@tarojs/components'
import './index.scss'

/**
 * 简易走势图（CSS 实现，无需 Canvas）
 * data: number[]
 * labels?: string[]
 * title?: string
 * color?: 'red' | 'green'
 */
export default function MiniChart({ title, data = [], labels = [], color = 'red' }) {
  if (!data.length) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const isUp = data[data.length - 1] >= data[0]
  const chartColor = color === 'auto' ? (isUp ? 'red' : 'green') : color

  return (
    <View className="mini-chart">
      {title && <Text className="mini-chart-title">{title}</Text>}
      <View className="mini-chart-body">
        <View className="mini-chart-y-axis">
          <Text className="mini-chart-y-label">{max.toFixed(2)}</Text>
          <Text className="mini-chart-y-label">{((max + min) / 2).toFixed(2)}</Text>
          <Text className="mini-chart-y-label">{min.toFixed(2)}</Text>
        </View>
        <View className="mini-chart-bars">
          {data.map((val, i) => {
            const heightPct = ((val - min) / range) * 100
            return (
              <View key={i} className="mini-chart-bar-col">
                <View
                  className={`mini-chart-bar ${chartColor === 'red' ? 'bar-red' : 'bar-green'}`}
                  style={{ height: `${Math.max(heightPct, 5)}%` }}
                />
                {labels[i] && (
                  <Text className="mini-chart-x-label">{labels[i]}</Text>
                )}
              </View>
            )
          })}
        </View>
      </View>
      <View className="mini-chart-footer">
        <Text className={`mini-chart-change ${isUp ? 'up' : 'down'}`}>
          {isUp ? '↑' : '↓'} {Math.abs(data[data.length - 1] - data[0]).toFixed(2)}
          ({((data[data.length - 1] - data[0]) / (data[0] || 1) * 100).toFixed(2)}%)
        </Text>
      </View>
    </View>
  )
}
