/**
 * Express 应用实例与中间件
 */
import express from 'express'
import cors from 'cors'
import { config } from './config'
import { routes } from './routes'
import { errorHandler } from './middleware/errorHandler'
import { requestLogger } from './middleware/logger'

export const app = express()

app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}))
app.use(express.json({ limit: config.bodyLimit }))
app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }))
app.use(requestLogger)

app.use(routes)
app.use(errorHandler)
