import request from './request'

export interface UserItem {
  id: string
  username: string
  role: 'admin' | 'trader'
  displayName: string
  status: 'active' | 'disabled'
  createdAt: number
  updatedAt: number
  lastLoginAt: number | null
}

export async function getUsers() {
  const { data } = await request.get<{ success: boolean; data: UserItem[] }>('/users')
  return data.data
}

export async function createUser(input: {
  username: string; password: string; role?: string; displayName?: string
}) {
  const { data } = await request.post<{ success: boolean; data: UserItem }>('/users', input)
  return data.data
}

export async function updateUser(id: string, updates: {
  displayName?: string; role?: string; status?: string; password?: string
}) {
  const { data } = await request.put<{ success: boolean; data: UserItem }>(`/users/${id}`, updates)
  return data.data
}

export async function deleteUser(id: string) {
  await request.delete(`/users/${id}`)
}
