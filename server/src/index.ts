/**
 * AI 研报分析 - 后端服务入口
 */
import { app } from './app'
import { config } from './config'
import { closeDb } from './db'

const server = app.listen(config.port, () => {
  console.log(`[Server] Running at http://localhost:${config.port}`)
  console.log(`[Server] Environment: ${config.nodeEnv}`)
  console.log(`[Server] DB: ${config.dbPath}`)
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server] Port ${config.port} already in use`)
  } else {
    console.error('[Server] Start error:', err.message)
  }
  process.exit(1)
})

function shutdown() {
  console.log('[Server] Shutting down...')
  closeDb()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5000)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason)
})
