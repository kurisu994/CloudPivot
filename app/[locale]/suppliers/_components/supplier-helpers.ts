export interface ToggleSupplierStatusArgs extends Record<string, unknown> {
  id: number
  is_enabled: boolean
}

export interface SupplierValidationInput {
  name: string
  contactPerson: string
  contactPhone: string
  email: string
  taxId: string
  bankAccount: string
}

export type SupplierValidationErrorKey =
  | 'nameRequired'
  | 'contactPersonRequired'
  | 'contactPhoneRequired'
  | 'contactPhoneInvalid'
  | 'emailInvalid'
  | 'taxIdInvalid'
  | 'bankAccountInvalid'

export function buildToggleSupplierStatusArgs(id: number, currentEnabled: boolean): ToggleSupplierStatusArgs {
  return {
    id,
    is_enabled: !currentEnabled,
  }
}

const PHONE_PATTERN = /^\+\d{1,3}[\s-]?\d[\d\s-]{7,17}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VN_TAX_ID_PATTERN = /^\d{10}(-\d{3})?$/
const CN_TAX_ID_PATTERN = /^[0-9A-Z]{18}$/
const BANK_ACCOUNT_PATTERN = /^\d{9,19}$/

export function validateSupplierForm(input: SupplierValidationInput): Partial<Record<keyof SupplierValidationInput, SupplierValidationErrorKey>> {
  const errors: Partial<Record<keyof SupplierValidationInput, SupplierValidationErrorKey>> = {}

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

  if (input.taxId.trim()) {
    const normalizedTaxId = input.taxId.trim().toUpperCase()
    if (!VN_TAX_ID_PATTERN.test(normalizedTaxId) && !CN_TAX_ID_PATTERN.test(normalizedTaxId)) {
      errors.taxId = 'taxIdInvalid'
    }
  }

  if (input.bankAccount.trim() && !BANK_ACCOUNT_PATTERN.test(input.bankAccount.trim())) {
    errors.bankAccount = 'bankAccountInvalid'
  }

  return errors
}
