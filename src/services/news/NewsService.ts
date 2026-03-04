/**
 * 新闻服务 - 获取股市相关热点新闻
 * 使用韩小韩 API（免费）获取财经新闻
 * 后期可替换为自有服务端接口
 */
import { request } from '@/utils/request'

export interface NewsItem {
  id: string
  title: string
  url?: string
  source?: string
  time?: string
}

/** 存储适配接口，方便后期切换到服务端 */
export interface INewsDataSource {
  fetchHotNews(): Promise<NewsItem[]>
}

/** 本地免费 API 数据源 */
class FreeApiNewsSource implements INewsDataSource {
  async fetchHotNews(): Promise<NewsItem[]> {
    try {
      const res = await request<{
        success?: boolean
        data?: Array<{ title?: string; url?: string; mobilUrl?: string }>
      }>({
        url: 'https://api.vvhan.com/api/hotlist/zhihuHot',
        method: 'GET',
        timeout: 10000
      })

      if (res.data?.data && Array.isArray(res.data.data)) {
        return res.data.data.slice(0, 8).map((item, i) => ({
          id: `news-${i}`,
          title: item.title || '',
          url: item.url || item.mobilUrl || '',
          source: '热点',
          time: '今日'
        }))
      }
      return this.getFallbackNews()
    } catch {
      return this.getFallbackNews()
    }
  }

  private getFallbackNews(): NewsItem[] {
    return [
      { id: 'f1', title: '两会政策解读：科技创新与新质生产力成为核心关键词', source: '财经', time: '今日' },
      { id: 'f2', title: '全球油价波动加剧，能源板块迎来投资机遇', source: '能源', time: '今日' },
      { id: 'f3', title: 'AI大模型赛道持续火热，算力需求增长超预期', source: '科技', time: '今日' },
      { id: 'f4', title: '央行释放流动性信号，市场情绪显著回暖', source: '金融', time: '今日' },
      { id: 'f5', title: '新能源汽车销量创新高，产业链上下游全面受益', source: '汽车', time: '今日' },
    ]
  }
}

/** 预留：服务端数据源（二期实现） */
// class ServerNewsSource implements INewsDataSource {
//   async fetchHotNews(): Promise<NewsItem[]> {
//     const res = await request({ url: '/api/news/hot', method: 'GET' })
//     return res.data as NewsItem[]
//   }
// }

let newsSourceInstance: INewsDataSource | null = null

export function getNewsService(): INewsDataSource {
  if (!newsSourceInstance) {
    newsSourceInstance = new FreeApiNewsSource()
  }
  return newsSourceInstance
}

/** 后期切换数据源 */
export function setNewsDataSource(source: INewsDataSource): void {
  newsSourceInstance = source
}
