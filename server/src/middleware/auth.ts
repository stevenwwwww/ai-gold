/**
 * JWT 认证中间件
 * - requireAuth: 必须登录
 * - requireAdmin: 必须是超管
 * - optionalAuth: 可选登录（小程序兼容）
 */
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { getUser, type User } from '../services/userStore'

export interface JwtPayload {
  userId: string
  username: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: User
      jwtPayload?: JwtPayload
    }
  }
}

export function signToken(user: User): { token: string; refreshToken: string } {
  const payload: JwtPayload = { userId: user.id, username: user.username, role: user.role }
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn })
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwtSecret,
    { expiresIn: config.jwtRefreshExpiresIn }
  )
  return { token, refreshToken }
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload
  } catch {
    return null
  }
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req)
  if (!token) {
    res.status(401).json({ error: '未登录' })
    return
  }
  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: '登录已过期，请重新登录' })
    return
  }
  const user = getUser(payload.userId)
  if (!user || user.status !== 'active') {
    res.status(401).json({ error: '账号已被禁用' })
    return
  }
  req.user = user
  req.jwtPayload = payload
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: '权限不足，需要管理员权限' })
      return
    }
    next()
  })
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req)
  if (!token) { next(); return }
  const payload = verifyToken(token)
  if (payload) {
    const user = getUser(payload.userId)
    if (user && user.status === 'active') {
      req.user = user
      req.jwtPayload = payload
    }
  }
  next()
}
