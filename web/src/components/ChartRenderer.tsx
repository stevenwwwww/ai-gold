/**
 * 图表渲染器 — 基于 ECharts
 *
 * 功能：
 *   - 支持 bar / line / pie 三种图表类型
 *   - 点击图表可编辑数据（弹出 JSON 编辑器）
 *   - 编辑后实时更新图表
 *   - 支持回调通知父组件数据变更
 *
 * 数据格式（与后端 DeepAnalysis.ChartData 一致）：
 *   { type, title, labels, datasets: [{ label, data }] }
 */
import { useState, useRef, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { Button, Modal, Space, Tooltip } from 'antd'
import { EditOutlined, FullscreenOutlined } from '@ant-design/icons'
import JsonEditor from './JsonEditor'

export interface ChartData {
  type: 'bar' | 'line' | 'pie'
  title: string
  labels: string[]
  datasets: Array<{ label: string; data: number[] }>
}

interface Props {
  data: ChartData
  editable?: boolean
  onChange?: (data: ChartData) => void
  height?: number
}

export default function ChartRenderer({ data, editable = false, onChange, height = 300 }: Props) {
  const [editing, setEditing] = useState(false)
  const [editJson, setEditJson] = useState('')
  const chartRef = useRef<ReactECharts | null>(null)

  const option = useMemo(() => toEChartsOption(data), [data])

  const handleEdit = () => {
    setEditJson(JSON.stringify(data, null, 2))
    setEditing(true)
  }

  const handleSave = () => {
    try {
      const parsed = JSON.parse(editJson) as ChartData
      if (!parsed.type || !parsed.labels || !parsed.datasets) {
        throw new Error('数据格式不正确')
      }
      onChange?.(parsed)
      setEditing(false)
    } catch {
      // JSON 编辑器自己会高亮错误
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height }}
        notMerge
      />

      {editable && (
        <Space style={{ position: 'absolute', top: 4, right: 4 }}>
          <Tooltip title="编辑图表数据">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={handleEdit}
            />
          </Tooltip>
          <Tooltip title="全屏">
            <Button
              size="small"
              icon={<FullscreenOutlined />}
              onClick={() => chartRef.current?.getEchartsInstance()?.resize()}
            />
          </Tooltip>
        </Space>
      )}

      <Modal
        title="编辑图表数据 (JSON)"
        open={editing}
        onCancel={() => setEditing(false)}
        onOk={handleSave}
        width={640}
        okText="保存"
        cancelText="取消"
      >
        <JsonEditor value={editJson} onChange={setEditJson} height={400} />
      </Modal>
    </div>
  )
}

/** 将 ChartData 转为 ECharts option */
function toEChartsOption(data: ChartData) {
  const base = {
    title: { text: data.title, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' as const },
    grid: { left: '8%', right: '4%', bottom: '12%', top: '16%' },
  }

  if (data.type === 'pie') {
    return {
      ...base,
      tooltip: { trigger: 'item' as const },
      series: [{
        type: 'pie',
        radius: '60%',
        data: data.labels.map((label, i) => ({
          name: label,
          value: data.datasets[0]?.data[i] ?? 0,
        })),
      }],
    }
  }

  return {
    ...base,
    xAxis: { type: 'category' as const, data: data.labels },
    yAxis: { type: 'value' as const },
    series: data.datasets.map((ds) => ({
      name: ds.label,
      type: data.type,
      data: ds.data,
      smooth: data.type === 'line',
    })),
    legend: data.datasets.length > 1 ? { bottom: 0 } : undefined,
  }
}
