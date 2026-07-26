import { describe, expect, it } from 'vitest'
import type { VaultItem } from '@ciphervault/contracts'
import { passwordHealth } from './health'

const item = (id: string, password: string): VaultItem => ({
  id, schemaVersion: 2, type: 'login', name: id, category: 'Personal', favorite: false, tags: [], archived: false,
  createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), fields: { password },
})

describe('local password health', () => {
  it('detects weak and reused passwords without an API', () => {
    expect(passwordHealth([item(crypto.randomUUID(), 'weak'), item(crypto.randomUUID(), 'ReusedPassword123!'), item(crypto.randomUUID(), 'ReusedPassword123!')])).toEqual({ total: 3, strong: 2, weak: 1, reused: 2 })
  })
})
