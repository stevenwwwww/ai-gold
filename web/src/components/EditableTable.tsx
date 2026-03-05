/**
 * 可编辑表格 — 基于 Ant Design Table
 *
 * 功能：
 *   - 行内编辑：双击单元格即可编辑
 *   - 新增行 / 删除行
 *   - 编辑后回调通知父组件
 *   - 支持自定义列头
 *
 * 用途：
 *   - 研报详情页中的财务数据表格
 *   - 任何结构化数据的编辑展示
 */
import { useState } from 'react'
import { Table, Input, Button, Space, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'

interface Props {
  title?: string
  columns: string[]
  data: string[][]
  editable?: boolean
  onChange?: (data: string[][]) => void
}

export default function EditableTable({ title, columns, data, editable = false, onChange }: Props) {
  const [editingRow, setEditingRow] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<string[]>([])

  const startEdit = (rowIdx: number) => {
    setEditingRow(rowIdx)
    setEditValues([...data[rowIdx]])
  }

  const saveEdit = () => {
    if (editingRow === null) return
    const newData = [...data]
    newData[editingRow] = editValues
    onChange?.(newData)
    setEditingRow(null)
  }

  const cancelEdit = () => {
    setEditingRow(null)
    setEditValues([])
  }

  const addRow = () => {
    const newRow = columns.map(() => '')
    const newData = [...data, newRow]
    onChange?.(newData)
  }

  const deleteRow = (idx: number) => {
    const newData = data.filter((_, i) => i !== idx)
    onChange?.(newData)
  }

  const tableColumns = [
    ...columns.map((col, colIdx) => ({
      title: col,
      key: `col-${colIdx}`,
      render: (_: unknown, _record: unknown, rowIdx: number) => {
        if (editingRow === rowIdx) {
          return (
            <Input
              size="small"
              value={editValues[colIdx] ?? ''}
              onChange={(e) => {
                const newVals = [...editValues]
                newVals[colIdx] = e.target.value
                setEditValues(newVals)
              }}
              onPressEnter={saveEdit}
            />
          )
        }
        return data[rowIdx]?.[colIdx] ?? ''
      },
    })),
    ...(editable
      ? [{
          title: '操作',
          key: 'action',
          width: 100,
          render: (_: unknown, _record: unknown, rowIdx: number) => {
            if (editingRow === rowIdx) {
              return (
                <Space size="small">
                  <Button size="small" type="link" icon={<CheckOutlined />} onClick={saveEdit} />
                  <Button size="small" type="link" icon={<CloseOutlined />} onClick={cancelEdit} />
                </Space>
              )
            }
            return (
              <Space size="small">
                <Button size="small" type="link" icon={<EditOutlined />} onClick={() => startEdit(rowIdx)} />
                <Popconfirm title="删除此行？" onConfirm={() => deleteRow(rowIdx)}>
                  <Button size="small" type="link" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )
          },
        }]
      : []),
  ]

  const dataSource = data.map((row, i) => ({ key: i, row }))

  return (
    <div>
      <Table
        columns={tableColumns}
        dataSource={dataSource}
        pagination={false}
        bordered
        size="small"
        title={title ? () => title : undefined}
      />
      {editable && (
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          style={{ width: '100%', marginTop: 8 }}
          onClick={addRow}
        >
          新增行
        </Button>
      )}
    </div>
  )
}
