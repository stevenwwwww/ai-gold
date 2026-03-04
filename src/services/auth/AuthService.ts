/**
 * 认证服务 - 预留接口
 * 后续接入企业微信登录、手机号登录（商用）等
 */

export interface UserInfo {
  id: string
  name: string
  avatar?: string
  role?: 'admin' | 'researcher' | 'user'
}

/**
 * 获取当前用户（预留）
 * 开发阶段返回 mock，生产接入企业微信授权
 */
export async function getCurrentUser(): Promise<UserInfo | null> {
  // TODO: 接入企业微信 Taro.getUserProfile / 企业微信登录
  // TODO: 商用模式接入手机号登录
  return null
}

/**
 * 检查登录状态（预留）
 */
export function isLoggedIn(): boolean {
  // TODO: 检查 token / 企业微信 session
  return false
}

/**
 * 登出（预留）
 */
export function logout(): void {
  // TODO: 清除 token、跳转登录页
}
