import type { VaultItem, VaultItemType } from '@ciphervault/contracts'
import type { passwordHealth } from '../../health'
import { dashboardTypeOrder } from './item-types'

export type HealthMetrics = ReturnType<typeof passwordHealth>

export function securityScore(health: HealthMetrics, compromised = 0): number {
  if (!health.total) return 100
  const score = 100
    - (health.weak / health.total) * 45
    - (health.reused / health.total) * 30
    - (compromised / health.total) * 25
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function categoryCounts(items: VaultItem[]) {
  const live = items.filter((item) => !item.archived)
  const count = (type: VaultItemType) => live.filter((item) => item.type === type).length
  return {
    ...Object.fromEntries(dashboardTypeOrder.map((type) => [type, count(type)])) as Record<VaultItemType, number>,
    archive: items.filter((item) => item.archived).length,
  }
}

export function recentItems(items: VaultItem[], limit = 5): VaultItem[] {
  return items.filter((item) => !item.archived)
    .slice().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, limit)
}

export function relativeTime(value: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(value))
  if (elapsed < 60_000) return 'Just now'
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`
  return `${Math.floor(elapsed / 86_400_000)}d ago`
}

export function healthLabel(score: number): { label: string; tone: 'good' | 'warning' | 'danger' } {
  if (score >= 85) return { label: 'Strong protection', tone: 'good' }
  if (score >= 60) return { label: 'Needs attention', tone: 'warning' }
  return { label: 'Action required', tone: 'danger' }
}
