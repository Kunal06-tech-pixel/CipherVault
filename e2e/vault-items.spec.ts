import { expect, test, type Page } from '@playwright/test'

const masterPassword = 'a-secure-test-password-123'
const selectableTypes = [
  { label: 'Login Credential', field: 'Username or email' },
  { label: 'Payment Card', field: 'Cardholder name' },
  { label: 'Bank Account', field: 'Bank name' },
  { label: 'Secure Note', field: 'Private content' },
  { label: 'Recovery Codes', field: 'Recovery-code list' },
  { label: 'API Secret', field: 'Service or provider' },
  { label: 'Wi-Fi Credential', field: 'Network name or SSID' },
  { label: 'Identity Document', field: 'Document type' },
  { label: 'Software Licence', field: 'Licence key' },
  { label: 'Custom Secret', field: 'Custom fields' },
]

async function registerVault(page: Page, suffix: string) {
  await page.goto('/app?mode=register')
  await page.getByLabel('Email address').fill(`playwright-${suffix}-${Date.now()}@example.invalid`)
  await page.getByLabel('Master password', { exact: true }).fill(masterPassword)
  await page.getByLabel('Confirm master password').fill(masterPassword)
  await page.getByRole('button', { name: /create zero-knowledge account/i }).click()
  await expect(page.getByRole('dialog', { name: /save this key offline/i })).toBeVisible()
  await page.locator('label.recovery-confirm').click()
  await page.getByRole('button', { name: /continue to my vault/i }).click()
  await expect(page.getByRole('heading', { name: /all items/i })).toBeVisible()
}

async function openAddItem(page: Page) {
  await page.getByRole('button', { name: /^Add item$/i }).click()
  await expect(page.getByRole('dialog', { name: /add secure item/i })).toBeVisible()
}

function itemEditor(page: Page) {
  return page.getByRole('dialog', { name: /add secure item|new vault item|select item type|custom secret|payment card|login credential|bank account|secure note|recovery codes|api secret|wi-fi credential|identity document|software licence/i })
}

test.describe('Keywall vault item refinement', () => {
  test('selects every new item type before showing the dynamic form', async ({ page }) => {
    await registerVault(page, 'types')
    await openAddItem(page)

    for (const type of selectableTypes) {
      const dialog = itemEditor(page)
      await dialog.getByRole('button', { name: new RegExp(type.label, 'i') }).click()
      await expect(dialog.getByRole('heading', { name: type.label, exact: true })).toBeVisible()
      await expect(dialog.getByText(type.field, { exact: false }).first()).toBeVisible()
      await dialog.getByRole('button', { name: /back to item types/i }).click()
    }

    await expect(itemEditor(page).getByRole('button', { name: /Authenticator/i })).toHaveCount(0)
    await itemEditor(page).getByRole('button', { name: 'Close' }).click()
  })

  test('creates, masks, reveals, edits, and deletes a custom secret', async ({ page }) => {
    await registerVault(page, 'custom')
    await openAddItem(page)
    await itemEditor(page).getByRole('button', { name: /Custom Secret/i }).click()
    await page.getByPlaceholder('e.g. Private deployment bundle').fill('Deployment bundle')
    await page.getByRole('button', { name: /add custom field/i }).click()
    await page.getByPlaceholder('Field label').fill('Deploy token')
    await page.getByPlaceholder('Field value').fill('super-secret-token')
    await page.locator('label.compact-toggle').filter({ hasText: 'Sensitive' }).click()
    await page.getByRole('button', { name: /encrypt and save/i }).click()

    const row = page.locator('.production-row').filter({ hasText: 'Deployment bundle' })
    await expect(row).toBeVisible()
    await row.click()
    await expect(page.locator('.production-detail')).toContainText('Custom Secret')
    await expect(page.locator('.production-detail')).toContainText('************')
    await expect(page.locator('.production-detail')).not.toContainText('super-secret-token')

    await page.getByRole('button', { name: 'Reveal value' }).click()
    await expect(page.getByRole('dialog', { name: /confirm master password/i })).toBeVisible()
    await page.getByPlaceholder('Master password').fill(masterPassword)
    await page.getByRole('button', { name: /^Confirm$/ }).click()
    await expect(page.locator('.production-detail')).toContainText('super-secret-token')

    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByPlaceholder('e.g. Private deployment bundle').fill('Deployment bundle updated')
    await page.getByRole('button', { name: /encrypt and save/i }).click()
    await expect(page.locator('.production-row').filter({ hasText: 'Deployment bundle updated' })).toBeVisible()

    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('dialog', { name: /confirm master password/i })).toBeVisible()
    await page.getByPlaceholder('Master password').fill(masterPassword)
    await page.getByRole('button', { name: /^Confirm$/ }).click()
    await expect(page.locator('.production-row').filter({ hasText: 'Deployment bundle updated' })).toHaveCount(0)
  })
})

test.describe('Keywall responsive add-item modal', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('keeps the type selector usable on mobile', async ({ page }) => {
    await registerVault(page, 'mobile')
    await page.getByRole('button', { name: /^Add item$/i }).click()
    const dialog = itemEditor(page)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Payment Card/i })).toBeVisible()
    await dialog.getByRole('button', { name: /Payment Card/i }).click()
    await expect(dialog.getByText('Cardholder name', { exact: false })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /back to item types/i })).toBeVisible()
  })
})
