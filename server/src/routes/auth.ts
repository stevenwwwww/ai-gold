/**
 * 认证路由 - 登录/刷新Token/修改密码/当前用户信息
 */
import { Router } from 'express'
import { verifyPassword } from '../services/userStore'
import { signToken, requireAuth, verifyToken } from '../middleware/auth'
import { getUser } from '../services/userStore'
import bcrypt from 'bcryptjs'
import { getDb } from '../db'

export const authRouter = Router()

authRouter.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' })
      return
    }

    const user = await verifyPassword(username, password)
    if (!user) {
      res.status(401).json({ error: '用户名或密码错误' })
      return
    }

    const tokens = signToken(user)
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
      },
      ...tokens,
    })
  } catch (e) {
    console.error('[Auth] login error:', e)
    res.status(500).json({ error: '登录失败' })
  }
})

authRouter.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      res.status(400).json({ error: '缺少 refreshToken' })
      return
    }

    const payload = verifyToken(refreshToken)
    if (!payload) {
      res.status(401).json({ error: 'refreshToken 已过期' })
      return
    }

    const user = getUser(payload.userId)
    if (!user || user.status !== 'active') {
      res.status(401).json({ error: '账号不可用' })
      return
    }

    const tokens = signToken(user)
    res.json({ success: true, ...tokens })
  } catch (e) {
    console.error('[Auth] refresh error:', e)
    res.status(500).json({ error: '刷新失败' })
  }
})

authRouter.get('/auth/me', requireAuth, (req, res) => {
  const u = req.user!
  res.json({
    success: true,
    user: {
      id: u.id,
      username: u.username,
      role: u.role,
      displayName: u.displayName,
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    },
  })
})

authRouter.put('/auth/password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: '旧密码和新密码不能为空' })
      return
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: '新密码至少 6 位' })
      return
    }

    const db = getDb()
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as { password_hash: string } | undefined
    if (!row) {
      res.status(404).json({ error: '用户不存在' })
      return
    }

    const ok = await bcrypt.compare(oldPassword, row.password_hash)
    if (!ok) {
      res.status(400).json({ error: '旧密码错误' })
      return
    }

    const hash = await bcrypt.hash(newPassword, 10)
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, Date.now(), req.user!.id)
    res.json({ success: true, message: '密码修改成功' })
  } catch (e) {
    console.error('[Auth] password change error:', e)
    res.status(500).json({ error: '修改密码失败' })
  }
})
