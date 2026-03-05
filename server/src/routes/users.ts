/**
 * 用户管理路由 - 超管专用
 */
import { Router } from 'express'
import { requireAdmin } from '../middleware/auth'
import { listUsers, createUser, updateUser, deleteUser, getUser } from '../services/userStore'

export const usersRouter = Router()

usersRouter.get('/users', requireAdmin, (_req, res) => {
  const users = listUsers()
  res.json({ success: true, data: users })
})

usersRouter.get('/users/:id', requireAdmin, (req, res) => {
  const user = getUser(req.params.id)
  if (!user) {
    res.status(404).json({ error: '用户不存在' })
    return
  }
  res.json({ success: true, data: user })
})

usersRouter.post('/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, role, displayName } = req.body
    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ error: '密码至少 6 位' })
      return
    }
    if (role && !['admin', 'trader'].includes(role)) {
      res.status(400).json({ error: '角色只能是 admin 或 trader' })
      return
    }

    const user = await createUser({ username, password, role, displayName })
    res.json({ success: true, data: user })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '创建失败'
    res.status(400).json({ error: msg })
  }
})

usersRouter.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { displayName, role, status, password } = req.body
    if (role && !['admin', 'trader'].includes(role)) {
      res.status(400).json({ error: '角色只能是 admin 或 trader' })
      return
    }
    if (status && !['active', 'disabled'].includes(status)) {
      res.status(400).json({ error: '状态只能是 active 或 disabled' })
      return
    }
    if (password && password.length < 6) {
      res.status(400).json({ error: '密码至少 6 位' })
      return
    }

    const user = await updateUser(req.params.id, { displayName, role, status, password })
    if (!user) {
      res.status(404).json({ error: '用户不存在' })
      return
    }
    res.json({ success: true, data: user })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '更新失败'
    res.status(400).json({ error: msg })
  }
})

usersRouter.delete('/users/:id', requireAdmin, (req, res) => {
  if (req.user?.id === req.params.id) {
    res.status(400).json({ error: '不能删除自己的账号' })
    return
  }
  const ok = deleteUser(req.params.id)
  if (!ok) {
    res.status(404).json({ error: '用户不存在' })
    return
  }
  res.json({ success: true })
})
