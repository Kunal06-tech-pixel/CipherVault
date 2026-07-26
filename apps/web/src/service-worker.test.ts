import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('offline service worker policy', () => {
  it('caches only same-origin GET assets and explicitly excludes API traffic', async () => {
    const source = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8')
    expect(source).toContain("request.method !== 'GET'")
    expect(source).toContain('url.origin !== self.location.origin')
    expect(source).toContain("url.pathname.startsWith('/v1/')")
    expect(source).toContain("url.pathname.startsWith('/health/')")
    expect(source).not.toContain('indexedDB')
    expect(source).not.toContain('localStorage')
  })
})
