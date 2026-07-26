import { describe, expect, it } from 'vitest'
import type { VaultItem } from '@ciphervault/contracts'
import { categoryCounts, healthLabel, recentItems, securityScore } from './dashboard-metrics'

const item = (id: string, type: VaultItem['type'], updatedAt: string, archived = false): VaultItem => ({ id, schemaVersion: 2, type, name: id, category: 'Personal', fields: {}, favorite: false, tags: [], archived, createdAt: updatedAt, updatedAt })

describe('vault dashboard metrics', () => {
  it('scores empty and unhealthy vaults within bounds', () => { expect(securityScore({ total: 0, strong: 0, weak: 0, reused: 0 })).toBe(100); expect(securityScore({ total: 2, strong: 0, weak: 2, reused: 2 }, 2)).toBe(0) })
  it('counts live categories and archive separately', () => { expect(categoryCounts([item('a', 'login', '2026-01-01T00:00:00Z'), item('b', 'payment_card', '2026-01-01T00:00:00Z', true)])).toMatchObject({ login: 1, payment_card: 0, archive: 1 }) })
  it('orders recent live items by update time', () => { expect(recentItems([item('old', 'login', '2026-01-01T00:00:00Z'), item('new', 'login', '2026-02-01T00:00:00Z'), item('archived', 'login', '2026-03-01T00:00:00Z', true)]).map((value) => value.id)).toEqual(['new', 'old']) })
  it('maps score bands to actionable labels', () => { expect(healthLabel(90).tone).toBe('good'); expect(healthLabel(70).tone).toBe('warning'); expect(healthLabel(30).tone).toBe('danger') })
})
