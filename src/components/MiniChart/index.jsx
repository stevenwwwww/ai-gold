import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import './index.scss'

/**
 * 可交互走势图组件
 * 支持点击柱状图显示具体数值
 */
export default function MiniChart({ title, data = [], labels = [], color = 'red' }) {
  const [activeIdx, setActiveIdx] = useState(-1)

  if (!data.length) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const isUp = data[data.length - 1] >= data[0]
  const chartColor = color === 'auto' ? (isUp ? 'red' : 'green') : color

  const changeVal = data[data.length - 1] - data[0]
  const changePct = ((changeVal / (data[0] || 1)) * 100).toFixed(2)

  return (
    <View className="mchart">
      <View className="mchart-head">
        {title && <Text className="mchart-title">{title}</Text>}
        <Text className={`mchart-badge ${isUp ? 'up' : 'down'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(changeVal).toFixed(2)} ({changePct}%)
        </Text>
      </View>

      {activeIdx >= 0 && (
        <View className="mchart-tooltip">
          <Text className="mchart-tooltip-label">{labels[activeIdx] || `#${activeIdx + 1}`}</Text>
          <Text className="mchart-tooltip-val">{data[activeIdx].toFixed(2)}</Text>
        </View>
      )}

      <View className="mchart-area">
        <View className="mchart-y">
          <Text className="mchart-y-val">{max.toFixed(0)}</Text>
          <Text className="mchart-y-val">{((max + min) / 2).toFixed(0)}</Text>
          <Text className="mchart-y-val">{min.toFixed(0)}</Text>
        </View>
        <View className="mchart-grid">
          <View className="mchart-grid-line" style={{ top: '0%' }} />
          <View className="mchart-grid-line" style={{ top: '50%' }} />
          <View className="mchart-grid-line" style={{ top: '100%' }} />
          <View className="mchart-bars">
            {data.map((val, i) => {
              const h = ((val - min) / range) * 100
              const isActive = activeIdx === i
              return (
                <View
                  key={i}
                  className={`mchart-col ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveIdx(isActive ? -1 : i)}
                >
                  <View className="mchart-bar-wrap">
                    <View
                      className={`mchart-bar ${chartColor === 'red' ? 'c-red' : 'c-green'}`}
                      style={{ height: `${Math.max(h, 4)}%` }}
                    >
                      {isActive && (
                        <Text className="mchart-bar-label">{val.toFixed(1)}</Text>
                      )}
                    </View>
                  </View>
                  {labels[i] && (
                    <Text className="mchart-x-label">{labels[i]}</Text>
                  )}
                </View>
              )
            })}
          </View>
        </View>
      </View>

      <View className="mchart-legend">
        {['当次查', '近一月', '近三月'].map((item, i) => (
          <View key={i} className={`mchart-legend-item ${i === 0 ? 'active' : ''}`}>
            <Text className="mchart-legend-text">{item}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
