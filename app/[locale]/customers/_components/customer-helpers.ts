/** 切换客户状态的参数类型 */
export interface ToggleCustomerStatusArgs extends Record<string, unknown> {
  id: number
  is_enabled: boolean
}

/** 客户表单校验输入 */
export interface CustomerValidationInput {
  name: string
  contactPerson: string
  contactPhone: string
  email: string
}

/** 客户表单校验错误键 */
export type CustomerValidationErrorKey = 'nameRequired' | 'contactPersonRequired' | 'contactPhoneRequired' | 'contactPhoneInvalid' | 'emailInvalid'

/**
 * 构建切换客户状态的 IPC 参数
 * @param id 客户 ID
 * @param currentEnabled 当前启用状态
 */
export function buildToggleCustomerStatusArgs(id: number, currentEnabled: boolean): ToggleCustomerStatusArgs {
  return {
    id,
    is_enabled: !currentEnabled,
  }
}

/** 国际电话号码格式：+ 开头，后跟数字（允许空格和连字符分隔） */
const PHONE_PATTERN = /^\+\d{1,3}[\s-]?\d[\d\s-]{7,17}$/

/** 基本邮箱格式校验 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 客户表单前端校验
 * 校验 name、contactPerson、contactPhone、email 四个字段
 */
export function validateCustomerForm(input: CustomerValidationInput): Partial<Record<keyof CustomerValidationInput, CustomerValidationErrorKey>> {
  const errors: Partial<Record<keyof CustomerValidationInput, CustomerValidationErrorKey>> = {}

  if (!input.name.trim()) {
    errors.name = 'nameRequired'
  }

  if (!input.contactPerson.trim()) {
    errors.contactPerson = 'contactPersonRequired'
  }

  if (!input.contactPhone.trim()) {
    errors.contactPhone = 'contactPhoneRequired'
  } else if (!PHONE_PATTERN.test(input.contactPhone.trim())) {
    errors.contactPhone = 'contactPhoneInvalid'
  }

  if (input.email.trim() && !EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'emailInvalid'
  }

  return errors
}
