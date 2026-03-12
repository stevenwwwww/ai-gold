/**
 * 医生助手路由 - /api/doctor/*
 */
import { Router, Request, Response } from 'express'
import { config } from '../config'
import * as ragflow from '../services/ragflowService'

export const doctorRouter = Router()

/** 获取医生助手可用的知识库 ID 列表 */
doctorRouter.get('/doctor/datasets', async (_req: Request, res: Response) => {
  try {
    if (config.ragflowMedicalDatasetId) {
      return res.json({ datasetIds: [config.ragflowMedicalDatasetId] })
    }
    const datasets = await ragflow.listDatasets({ page: 1, page_size: 20 })
    const medical = datasets.find(
      (d) =>
        d.name.toLowerCase().includes('medical') ||
        d.name.includes('医生') ||
        d.name.includes('medical_literature')
    )
    if (medical) {
      return res.json({ datasetIds: [medical.id] })
    }
    if (datasets.length > 0) {
      return res.json({ datasetIds: [datasets[0].id] })
    }
    res.json({ datasetIds: [] })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '获取失败' })
  }
})
