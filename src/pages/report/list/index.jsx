import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { reportService } from '@/services/report/ReportService'
import { usePageTheme } from '@/components/ThemeProvider'
import './index.scss'

export default function ReportList() {
  const tc = usePageTheme()
  const [list, setList] = useState([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadList() }, [])

  const loadList = () => {
    setLoading(true)
    reportService.getReportList()
      .then((data) => setList(data))
      .catch(() => Taro.showToast({ title: '加载失败', icon: 'none' }))
      .finally(() => setLoading(false))
  }

  const handleDelete = (e, id) => {
    e.stopPropagation()
    Taro.showModal({
      title: '删除研报',
      content: '确认删除该研报及其聊天记录？',
      success: (res) => {
        if (res.confirm) {
          reportService.deleteReport(id)
            .then(() => {
              setList((prev) => prev.filter((r) => r.id !== id))
              Taro.showToast({ title: '已删除', icon: 'success' })
            })
            .catch(() => Taro.showToast({ title: '删除失败', icon: 'none' }))
        }
      }
    })
  }

  const filtered = keyword.trim()
    ? list.filter((r) => r.title.toLowerCase().includes(keyword.toLowerCase()))
    : list

  const goSummary = (id) => {
    Taro.navigateTo({ url: `/pages/report/summary/index?id=${id}` })
  }

  const goEntry = () => {
    Taro.navigateTo({ url: '/pages/report/entry/index' })
  }

  return (
    <View className={`report-list ${tc}`}>
      <View className="report-list-header">
        <Input
          className="report-list-search"
          placeholder="搜索研报"
          value={keyword}
          onInput={(e) => setKeyword(e.detail?.value || '')}
        />
        <View className="report-list-add" onClick={goEntry}>
          <Text>+ 新建</Text>
        </View>
      </View>

      <ScrollView scrollY className="report-list-body">
        {loading ? (
          <View className="report-list-empty">
            <Text>加载中...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="report-list-empty">
            <Text>暂无研报</Text>
            <Text className="report-list-empty-hint">上传 PDF 或粘贴文本开始分析</Text>
            <View className="report-list-empty-btn" onClick={goEntry}>
              <Text>去添加</Text>
            </View>
          </View>
        ) : (
          filtered.map((r) => (
            <View
              key={r.id}
              className="report-list-item"
              onClick={() => goSummary(r.id)}
            >
              <View className="report-list-item-info">
                <Text className="report-list-item-title">{r.title}</Text>
                <Text className="report-list-item-time">
                  {new Date(r.updatedAt).toLocaleDateString()}
                </Text>
              </View>
              <View
                className="report-list-item-del"
                onClick={(e) => handleDelete(e, r.id)}
              >
                <Text>删除</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
