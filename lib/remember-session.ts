/** 记住我会话的默认天数。配置缺失或非法时使用。 */
export const DEFAULT_REMEMBER_ME_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000
/** 防止配置被写成过大的值，把本地会话无限期留在磁盘上。 */
const MAX_REMEMBER_ME_DAYS = 365

/**
 * 把 system_config.remember_session_days 换成毫秒。
 * 非数字、非正数或超过上限时回退到默认 7 天。小数向下取整。
 */
export function rememberMeDurationMs(raw: string | null | undefined): number {
  const days = Number(raw)
  if (!Number.isFinite(days) || days <= 0 || days > MAX_REMEMBER_ME_DAYS) {
    return DEFAULT_REMEMBER_ME_DAYS * MS_PER_DAY
  }
  return Math.floor(days) * MS_PER_DAY
}
