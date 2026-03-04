/**
 * UI 主题常量 - 简洁白主调
 */
export const theme = {
  // 主背景
  background: '#FFFFFF',
  // 次级背景
  backgroundSecondary: '#F8F9FA',
  // 主文字
  textPrimary: '#1A1A1A',
  // 次级文字
  textSecondary: '#6B7280',
  // 强调色（按钮、链接）
  accent: '#3B82F6',
  // 圆角
  radiusSmall: '8px',
  radiusMedium: '12px',
  // 间距基准
  spacing: 16,
  // 边框
  border: '#E5E7EB',
  // 错误色
  error: '#EF4444',
  // 成功色
  success: '#22C55E'
} as const

export type Theme = typeof theme
