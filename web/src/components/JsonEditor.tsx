/**
 * JSON 编辑器 — 基于 Monaco Editor
 *
 * 用途：
 *   - 图表数据编辑（点击图表的编辑按钮弹出）
 *   - 任何需要编辑 JSON 的场景
 *
 * 特性：
 *   - 语法高亮 + 自动格式化
 *   - 实时错误提示
 *   - 自适应高度
 */
import Editor from '@monaco-editor/react'

interface Props {
  value: string
  onChange: (value: string) => void
  height?: number
  readOnly?: boolean
}

export default function JsonEditor({ value, onChange, height = 300, readOnly = false }: Props) {
  return (
    <Editor
      height={height}
      language="json"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        formatOnPaste: true,
        automaticLayout: true,
        tabSize: 2,
      }}
      theme="vs-dark"
    />
  )
}
