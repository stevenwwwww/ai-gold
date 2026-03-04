/**
 * 审计服务 - 预留接口
 * 后续实现：操作日志、查看记录、提问记录、导出记录
 * 与 PRD 权限管理与审计模块对齐
 */

/**
 * 记录用户查看研报（预留）
 */
export function logView(docId: string, _userId?: string): void {
  // TODO: 接入企业微信后记录
  console.log('[Audit] view:', docId)
}

/**
 * 记录用户提问（预留）
 */
export function logQuestion(question: string, _userId?: string): void {
  // TODO: 接入企业微信后记录
  console.log('[Audit] question:', question.slice(0, 50))
}

/**
 * 记录导出内容（预留）
 */
export function logExport(docId: string, _userId?: string): void {
  // TODO: 接入企业微信后记录
  console.log('[Audit] export:', docId)
}
