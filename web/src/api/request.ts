/**
 * Axios 请求封装 - 自动附加 JWT + 刷新 token + 错误处理
 */
import axios, { type AxiosError } from 'axios'
import { useAuthStore } from '@/store/auth'

const request = axios.create({
  baseURL: '/api',
  timeout: 120_000,
})

request.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().token
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

request.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<{ error?: string }>) => {
    const status = err.response?.status
    if (status === 401) {
      const { refreshToken, setTokens, logout } = useAuthStore.getState()
      if (refreshToken && err.config && !err.config.url?.includes('/auth/refresh')) {
        try {
          const res = await axios.post('/api/auth/refresh', { refreshToken })
          setTokens(res.data.token, res.data.refreshToken)
          err.config.headers.Authorization = `Bearer ${res.data.token}`
          return axios(err.config)
        } catch {
          logout()
        }
      } else {
        logout()
      }
    }
    const msg = err.response?.data?.error || err.message || '网络错误'
    return Promise.reject(new Error(msg))
  },
)

export default request
