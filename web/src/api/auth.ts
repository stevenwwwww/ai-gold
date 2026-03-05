import request from './request'

export interface LoginResult {
  success: boolean
  user: { id: string; username: string; role: string; displayName: string }
  token: string
  refreshToken: string
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const { data } = await request.post<LoginResult>('/auth/login', { username, password })
  return data
}

export async function getMe() {
  const { data } = await request.get<{ success: boolean; user: LoginResult['user'] }>('/auth/me')
  return data.user
}

export async function changePassword(oldPassword: string, newPassword: string) {
  const { data } = await request.put('/auth/password', { oldPassword, newPassword })
  return data
}
