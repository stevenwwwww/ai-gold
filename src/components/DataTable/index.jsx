import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'

/**
 * 数据表格组件
 * columns: [{ key: string, title: string, width?: string }]
 * data: [{ [key]: value }]
 */
export default function DataTable({ title, columns = [], data = [] }) {
  if (!columns.length || !data.length) return null

  return (
    <View className="data-table">
      {title && <Text className="data-table-title">{title}</Text>}
      <ScrollView scrollX className="data-table-scroll">
        <View className="data-table-inner">
          <View className="data-table-header">
            {columns.map((col) => (
              <View
                key={col.key}
                className="data-table-th"
                style={col.width ? { width: col.width, minWidth: col.width } : {}}
              >
                <Text className="data-table-th-text">{col.title}</Text>
              </View>
            ))}
          </View>
          {data.map((row, i) => (
            <View key={i} className={`data-table-row ${i % 2 === 0 ? 'even' : ''}`}>
              {columns.map((col) => (
                <View
                  key={col.key}
                  className="data-table-td"
                  style={col.width ? { width: col.width, minWidth: col.width } : {}}
                >
                  <Text className={`data-table-td-text ${getValueClass(row[col.key])}`}>
                    {row[col.key] ?? '-'}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

function getValueClass(val) {
  if (typeof val === 'string') {
    if (val.includes('+') || val.includes('涨') || val.includes('↑')) return 'val-up'
    if (val.includes('-') || val.includes('跌') || val.includes('↓')) return 'val-down'
  }
  return ''
}
