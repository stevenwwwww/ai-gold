/**
 * 请求日志中间件
 */
import { Request, Response, NextFunction } from 'express'

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()
  const { method, originalUrl } = req

  res.on('finish', () => {
    const ms = Date.now() - start
    const status = res.statusCode
    const tag = status >= 400 ? '[WARN]' : '[REQ]'
    console.log(`${tag} ${method} ${originalUrl} → ${status} (${ms}ms)`)
  })

  next()
}
