import { View, Text } from '@tarojs/components'
import './index.scss'

export default function DataTable({ title, columns = [], data = [] }) {
  if (!columns.length || !data.length) return null

  return (
    <View className="dtable">
      {title && (
        <View className="dtable-head">
          <Text className="dtable-title">{title}</Text>
        </View>
      )}
      <View className="dtable-wrap">
        <View className="dtable-header">
          {columns.map((col) => (
            <View key={col.key} className="dtable-th">
              <Text className="dtable-th-text">{col.title}</Text>
            </View>
          ))}
        </View>
        {data.map((row, i) => (
          <View key={i} className={`dtable-row ${i % 2 === 0 ? 'even' : ''}`}>
            {columns.map((col, ci) => (
              <View key={col.key} className="dtable-td">
                <Text className={`dtable-td-text ${ci === 0 ? 'bold' : ''} ${getColorClass(row[col.key])}`}>
                  {row[col.key] ?? '-'}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}

function getColorClass(val) {
  if (typeof val !== 'string') return ''
  if (val.includes('+') || val.includes('涨') || val.includes('↑')) return 'c-up'
  if (val.includes('-') || val.includes('跌') || val.includes('↓')) return 'c-down'
  return ''
}
