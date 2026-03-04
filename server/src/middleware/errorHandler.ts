/**
 * 全局错误处理中间件
 * 区分 4xx 客户端错误和 5xx 服务端错误
 */
import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  // Multer 文件大小超限
  if (err.message?.includes('File too large')) {
    res.status(413).json({ error: '文件太大' })
    return
  }

  console.error('[Error]', err.message, err.stack?.slice(0, 500))
  res.status(500).json({
    error: err.message || 'Internal Server Error',
  })
}
