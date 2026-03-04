/**
 * 网络请求封装
 * 基于 Taro.request，统一错误处理与超时
 */
import Taro from '@tarojs/taro'

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
  timeout?: number
}

export interface RequestResult<T = unknown> {
  data: T
  statusCode: number
  header: Record<string, string>
}

export async function request<T = unknown>(options: RequestOptions): Promise<RequestResult<T>> {
  const { url, method = 'GET', data, header = {}, timeout = 60000 } = options

  return new Promise((resolve, reject) => {
    Taro.request({
      url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header
      },
      timeout,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res as unknown as RequestResult<T>)
        } else {
          const body = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data)
          reject(new Error(`HTTP ${res.statusCode}: ${body}`))
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || 'Network error'))
      }
    })
  })
}
