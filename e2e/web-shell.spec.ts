import { expect, test } from '@playwright/test'

test.describe('CipherVault production web shell', () => {
  test('serves a restrictive security policy and accessible auth form', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    const csp = response?.headers()['content-security-policy'] ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    await expect(page.getByRole('heading', { name: /unlock ciphervault|create your encrypted vault/i })).toBeVisible()
    await expect(page.getByLabel('Email address')).toHaveAttribute('autocomplete', 'username')
    await expect(page.getByLabel('Master password')).toHaveAttribute('type', 'password')
  })

  test('enforces client-side password confirmation before registration', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.getByLabel('Email address').fill('playwright@example.invalid')
    await page.getByLabel('Master password').fill('a-secure-test-password-123')
    await page.getByLabel('Confirm master password').fill('different-password-123')
    await expect(page.getByRole('button', { name: /create zero-knowledge account/i })).toBeDisabled()
  })
})
