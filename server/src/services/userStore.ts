/**
 * 用户存储服务 - CRUD + 密码哈希
 * 角色: admin(超管) / trader(交易员)
 */
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'
import { getDb } from '../db'

export type UserRole = 'admin' | 'trader'
export type UserStatus = 'active' | 'disabled'

export interface User {
  id: string
  username: string
  role: UserRole
  displayName: string
  status: UserStatus
  createdAt: number
  updatedAt: number
  lastLoginAt: number | null
}

interface UserRow extends Record<string, unknown> {
  id: string
  username: string
  password_hash: string
  role: string
  display_name: string
  status: string
  created_at: number
  updated_at: number
  last_login_at: number | null
}

export interface CreateUserInput {
  username: string
  password: string
  role?: UserRole
  displayName?: string
}

const SALT_ROUNDS = 10

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    role: row.role as UserRole,
    displayName: row.display_name || row.username,
    status: row.status as UserStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  }
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(input.username)
  if (existing) throw new Error(`用户名 "${input.username}" 已存在`)

  const id = uuid()
  const now = Date.now()
  const hash = await bcrypt.hash(input.password, SALT_ROUNDS)

  db.prepare(`
    INSERT INTO users (id, username, password_hash, role, display_name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(id, input.username, hash, input.role || 'trader', input.displayName || input.username, now, now)

  return {
    id, username: input.username, role: input.role || 'trader',
    displayName: input.displayName || input.username,
    status: 'active', createdAt: now, updatedAt: now, lastLoginAt: null,
  }
}

export async function verifyPassword(username: string, password: string): Promise<User | null> {
  const db = getDb()
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
  if (!row) return null
  if (row.status !== 'active') return null

  const ok = await bcrypt.compare(password, row.password_hash)
  if (!ok) return null

  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), row.id)
  return rowToUser(row)
}

export function getUser(id: string): User | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  return row ? rowToUser(row) : null
}

export function getUserByUsername(username: string): User | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
  return row ? rowToUser(row) : null
}

export function listUsers(): User[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as UserRow[]
  return rows.map(rowToUser)
}

export async function updateUser(id: string, updates: {
  displayName?: string
  role?: UserRole
  status?: UserStatus
  password?: string
}): Promise<User | null> {
  const db = getDb()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) return null

  const now = Date.now()
  if (updates.password) {
    const hash = await bcrypt.hash(updates.password, SALT_ROUNDS)
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now, id)
  }
  if (updates.displayName !== undefined) {
    db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(updates.displayName, now, id)
  }
  if (updates.role) {
    db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(updates.role, now, id)
  }
  if (updates.status) {
    db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(updates.status, now, id)
  }

  return getUser(id)
}

export function deleteUser(id: string): boolean {
  const db = getDb()
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(id)
  return info.changes > 0
}

export function getUserCount(): number {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }
  return row.cnt
}

/**
 * 确保默认超管存在（服务启动时调用）
 */
export async function ensureDefaultAdmin(username: string, password: string): Promise<void> {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('admin')
  if (existing) return

  console.log(`[UserStore] 创建默认超管账号: ${username}`)
  await createUser({ username, password, role: 'admin', displayName: '超级管理员' })
}
