import { expect, test } from '@playwright/test'

test.describe('Keywall production web shell', () => {
  test('serves a restrictive security policy and public landing page', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    const csp = response?.headers()['content-security-policy'] ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    await expect(page.getByRole('link', { name: /launch app/i }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /private beta\. not public\. by design\./i })).toBeVisible()
  })

  test('serves accessible auth form from the app route', async ({ page }) => {
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: /unlock keywall/i })).toBeVisible()
    await expect(page.getByLabel('Email address')).toHaveAttribute('autocomplete', 'username')
    await expect(page.getByLabel('Master password')).toHaveAttribute('type', 'password')
  })

  test('enforces client-side password confirmation before registration', async ({ page }) => {
    await page.goto('/app?mode=register')
    await expect(page.getByRole('heading', { name: /create your encrypted vault/i })).toBeVisible()
    await page.getByLabel('Email address').fill('playwright@example.invalid')
    await page.getByLabel('Master password', { exact: true }).fill('a-secure-test-password-123')
    await page.getByLabel('Confirm master password').fill('different-password-123')
    await expect(page.getByRole('button', { name: /create zero-knowledge account/i })).toBeDisabled()
  })

  test('preserves recovery and verify-email routes', async ({ page }) => {
    await page.goto('/recover')
    await expect(page.getByRole('heading', { name: /request account recovery/i })).toBeVisible()
    await page.goto('/verify-email?token=invalid-test-token')
    await expect(page.getByRole('heading', { name: /unlock keywall/i })).toBeVisible()
  })
})
