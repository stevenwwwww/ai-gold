import { View, Text, ScrollView, Button, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { reportService } from '@/services/report/ReportService'
import { usePageTheme } from '@/components/ThemeProvider'
import './index.scss'

export default function ReportEntry() {
  const tc = usePageTheme()
  const [mode, setMode] = useState('upload')
  const [pastedText, setPastedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChoosePdf = () => {
    Taro.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf']
    })
      .then((res) => {
        const file = res.tempFiles[0]
        if (!file) return
        if (!file.name?.toLowerCase().endsWith('.pdf')) {
          setError('请选择 PDF 文件')
          return
        }
        setLoading(true)
        setError('')
        return reportService.parsePdf(file.path)
      })
      .then((result) => {
        if (!result?.reportId) return
        return generateAndNavigate(result.reportId)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : '解析失败')
      })
      .finally(() => setLoading(false))
  }

  const handlePasteSubmit = () => {
    const text = pastedText.trim()
    if (!text) {
      setError('请粘贴研报内容')
      return
    }
    setLoading(true)
    setError('')
    reportService
      .parseText(text)
      .then((result) => generateAndNavigate(result.reportId))
      .catch((e) => {
        setError(e instanceof Error ? e.message : '解析失败')
      })
      .finally(() => setLoading(false))
  }

  const generateAndNavigate = async (reportId) => {
    Taro.showLoading({ title: '生成摘要中...' })
    try {
      await reportService.getSummary(reportId)
      Taro.hideLoading()
      Taro.navigateTo({
        url: `/pages/report/summary/index?id=${reportId}`
      })
    } catch (e) {
      Taro.hideLoading()
      setError(e instanceof Error ? e.message : '摘要生成失败')
    }
  }

  return (
    <View className={`report-entry ${tc}`}>
      <ScrollView scrollY className="report-entry-body">
        <View className="report-entry-card">
          <Text className="report-entry-title">导入研报</Text>
          <Text className="report-entry-desc">
            上传 PDF 或粘贴文本，AI 将自动生成一页纸摘要
          </Text>

          <View className="report-entry-tabs">
            <View
              className={`report-entry-tab ${mode === 'upload' ? 'active' : ''}`}
              onClick={() => setMode('upload')}
            >
              <Text>上传 PDF</Text>
            </View>
            <View
              className={`report-entry-tab ${mode === 'paste' ? 'active' : ''}`}
              onClick={() => setMode('paste')}
            >
              <Text>粘贴文本</Text>
            </View>
          </View>

          {mode === 'upload' && (
            <View className="report-entry-upload">
              <Button
                className="report-entry-btn"
                onClick={handleChoosePdf}
                disabled={loading}
              >
                {loading ? '解析中...' : '选择 PDF 文件'}
              </Button>
            </View>
          )}

          {mode === 'paste' && (
            <View className="report-entry-paste">
              <Textarea
                className="report-entry-textarea"
                placeholder="粘贴研报全文或关键段落..."
                value={pastedText}
                onInput={(e) => setPastedText(e.detail.value)}
                maxlength={-1}
              />
              <Button
                className="report-entry-btn"
                onClick={handlePasteSubmit}
                disabled={loading || !pastedText.trim()}
              >
                {loading ? '生成中...' : '生成摘要'}
              </Button>
            </View>
          )}

          {error && (
            <View className="report-entry-error">
              <Text>{error}</Text>
            </View>
          )}
        </View>

        <View
          className="report-entry-link"
          onClick={() => Taro.navigateTo({ url: '/pages/report/list/index' })}
        >
          <Text>查看我的研报 ›</Text>
        </View>
        <View
          className="report-entry-link"
          onClick={() => Taro.navigateTo({ url: '/pages/report/browse/index' })}
        >
          <Text>浏览研报库（只读）›</Text>
        </View>
      </ScrollView>
    </View>
  )
}
