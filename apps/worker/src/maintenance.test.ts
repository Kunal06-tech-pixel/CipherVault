import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('retention safety', () => {
  it('releases abandoned attachment quota without time-deleting sync history', async () => {
    const source = await readFile(new URL('./maintenance.ts', import.meta.url), 'utf8')
    expect(source).toContain("status = 'pending'")
    expect(source).toContain("interval '24 hours'")
    expect(source).toContain('used_bytes = greatest(0')
    expect(source).not.toMatch(/delete\s+from\s+sync_changes/iu)
  })
})
