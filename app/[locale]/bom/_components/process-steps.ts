import type { useTranslations } from 'next-intl'

/**
 * 系统预设的工序 key（唯一定义处），存储时用英文 key，展示时走 i18n 翻译。
 * 数组顺序即分组展示时的排序顺序。
 */
export const PRESET_PROCESS_STEP_KEYS = [
  'sewing',
  'woodworking',
  'foam',
  'upholstery',
  'ironwork',
  'cutting',
  'assembly',
  'painting',
  'packaging',
] as const

const PRESET_KEY_SET = new Set<string>(PRESET_PROCESS_STEP_KEYS)

type BomTranslator = ReturnType<typeof useTranslations<'bom'>>

/** 判断工序值是否为系统预设 key */
export function isPresetProcessStep(step: string): boolean {
  return PRESET_KEY_SET.has(step)
}

/** 工序值翻译：匹配预设 key 走 i18n，否则原样展示 */
export function translateProcessStep(step: string, t: BomTranslator): string {
  if (isPresetProcessStep(step)) {
    return t(`form.processSteps.${step}` as any)
  }
  return step
}

/**
 * 工序输入归一化：输入文本若匹配预设 key 或当前语言的预设 label（忽略大小写），
 * 转存为对应 key，避免同一工序以 key 和字面文本两种形式混存导致分组分裂；
 * 其余自定义文本去除首尾空白后原样保存。
 */
export function normalizeProcessStep(input: string, t: BomTranslator): string {
  const text = input.trim()
  if (!text) return ''
  const lower = text.toLowerCase()
  for (const key of PRESET_PROCESS_STEP_KEYS) {
    if (key === lower || translateProcessStep(key, t).toLowerCase() === lower) {
      return key
    }
  }
  return text
}
