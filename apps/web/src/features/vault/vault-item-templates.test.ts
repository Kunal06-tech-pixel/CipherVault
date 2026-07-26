import { describe, expect, it } from 'vitest'
import { dashboardTypeOrder, selectableVaultItemTypes } from './item-types'
import { initialFieldsFor, itemTemplates, selectableTemplates } from './vault-item-templates'

describe('vault item templates', () => {
  it('exposes the 10 selectable product templates without totp', () => {
    expect(selectableTemplates.map((template) => template.type)).toEqual(selectableVaultItemTypes)
    expect(dashboardTypeOrder).toEqual(selectableVaultItemTypes)
    expect(selectableTemplates).toHaveLength(10)
    expect(selectableTemplates.some((template) => template.type === 'totp')).toBe(false)
  })

  it('keeps totp editable through the template registry', () => {
    expect(itemTemplates.totp.fields.map((field) => field.key)).toContain('secret')
  })

  it('creates stable initial form fields from template defaults', () => {
    expect(initialFieldsFor('custom_secret')).toMatchObject({ customFields: [], secureNotes: '' })
    expect(initialFieldsFor('recovery_codes')).toMatchObject({ codes: [] })
    expect(initialFieldsFor('payment_card')).toMatchObject({ cardType: 'Credit', network: 'Visa' })
  })
})
