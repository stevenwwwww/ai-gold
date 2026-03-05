/**
 * Express 应用实例与中间件
 */
import express from 'express'
import cors from 'cors'
import path from 'path'
import { config } from './config'
import { routes } from './routes'
import { errorHandler } from './middleware/errorHandler'
import { requestLogger } from './middleware/logger'

export const app = express()

app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}))
app.use(express.json({ limit: config.bodyLimit }))
app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }))
app.use(requestLogger)

app.use(routes)

const webDist = path.join(__dirname, '../../web/dist')
app.use(express.static(webDist))
app.get(/^\/(?!api|health).*/, (_req, res) => {
  res.sendFile(path.join(webDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Web 前端未构建' })
  })
})

app.use(errorHandler)
