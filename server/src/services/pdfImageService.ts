/**
 * PDF 转图片服务 — 将 PDF 每一页渲染为 PNG base64
 *
 * 技术选型：pdf-to-img（基于 pdfjs-dist + @napi-rs/canvas）
 *   - 纯 JS 实现，零系统级依赖（不需要 poppler / ghostscript）
 *   - 适合私有化部署，无需额外安装系统包
 *   - 渲染精度足够（默认 150 DPI，可配置）
 *
 * 使用场景：
 *   PDF 上传后，逐页转图片 → 发给 Qwen-VL 多模态模型进行视觉识别
 *   识别结果包含：纯文本、表格结构、图表描述
 *
 * 降级策略：
 *   如果图片转换失败（内存不足、PDF 加密等），返回空数组
 *   调用方会降级为 pdf-parse 纯文本提取
 */

import { config } from '../config'

/**
 * 单页渲染结果
 * @property pageIndex - 页码（从 0 开始）
 * @property base64    - PNG 图片的 base64 编码（不含 data:image/png;base64, 前缀）
 * @property width     - 图片宽度（像素）
 * @property height    - 图片高度（像素）
 */
export interface PageImage {
  pageIndex: number
  base64: string
  width: number
  height: number
}

/**
 * 将 PDF Buffer 的每一页渲染为 PNG base64 图片
 *
 * @param pdfBuffer  - PDF 文件的 Buffer
 * @param maxPages   - 最大处理页数，防止超大 PDF 耗尽资源（默认从配置读取）
 * @param scale      - 渲染缩放比例，1.0 = 72 DPI, 2.0 = 144 DPI（默认 2.0，平衡清晰度和大小）
 * @returns 每一页的 base64 PNG 图片数组
 *
 * @example
 * ```ts
 * const images = await pdfToImages(buffer)
 * // images[0].base64 → "iVBORw0KGgo..."
 * // images[0].pageIndex → 0
 * ```
 */
export async function pdfToImages(
  pdfBuffer: Buffer,
  maxPages?: number,
  scale = 2.0
): Promise<PageImage[]> {
  const limit = maxPages ?? config.vlMaxPages ?? 30

  try {
    // pdf-to-img v5 使用 ESM 导出，需要动态 import
    const { pdf } = await import('pdf-to-img')

    const pages: PageImage[] = []
    let pageIndex = 0

    // pdf() 返回异步迭代器，每次 yield 一页的 PNG Buffer
    const document = await pdf(pdfBuffer, { scale })

    for await (const pageBuffer of document) {
      if (pageIndex >= limit) {
        console.log(`[PdfImage] 达到最大页数限制 ${limit}，停止渲染`)
        break
      }

      const base64 = Buffer.from(pageBuffer).toString('base64')

      pages.push({
        pageIndex,
        base64,
        // pdf-to-img 不直接返回尺寸，通过 PNG header 解析
        // PNG 宽度在 offset 16-20 (4 bytes big-endian)
        // PNG 高度在 offset 20-24 (4 bytes big-endian)
        width: readPngDimension(pageBuffer, 16),
        height: readPngDimension(pageBuffer, 20),
      })

      pageIndex++
    }

    console.log(`[PdfImage] 成功渲染 ${pages.length} 页 (scale=${scale})`)
    return pages
  } catch (err) {
    console.error('[PdfImage] PDF 转图片失败:', err)
    return []
  }
}

/**
 * 从 PNG 文件的二进制数据中读取宽度/高度
 * PNG 格式：offset 16 = width (4B BE), offset 20 = height (4B BE)
 */
function readPngDimension(buf: Buffer | Uint8Array, offset: number): number {
  if (buf.length < offset + 4) return 0
  return (buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]
}
