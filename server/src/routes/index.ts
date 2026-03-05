/**
 * 路由聚合
 */
import { Router } from 'express'
import { healthRouter } from './health'
import { parseRouter } from './parse'
import { chatRouter } from './chat'
import { summaryRouter } from './summary'
import { reportsRouter } from './reports'
import { authRouter } from './auth'
import { usersRouter } from './users'

export const routes = Router()

routes.use(healthRouter)
routes.use('/api', authRouter)
routes.use('/api', usersRouter)
routes.use('/api', parseRouter)
routes.use('/api', chatRouter)
routes.use('/api', summaryRouter)
routes.use('/api', reportsRouter)
