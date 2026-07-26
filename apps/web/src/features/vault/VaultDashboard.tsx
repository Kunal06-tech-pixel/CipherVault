import { Archive, CreditCard, FileText, Fingerprint, HeartPulse, IdCard, KeyRound, Layers3, ShieldCheck, Star } from 'lucide-react'
import type { VaultItem } from '@ciphervault/contracts'
import * as React from 'react'
import type { passwordHealth } from '../../health'
import { typeIcons } from './item-types'
import { categoryCounts, healthLabel, recentItems, relativeTime, securityScore } from './dashboard-metrics'

type DashboardView = 'login' | 'secureNote' | 'card' | 'identity' | 'totp' | 'archive' | 'health'

export function VaultDashboard({ items, health, compromised, loading, onSelect, onNavigate, onToggleFavorite }: {
  items: VaultItem[]
  health: ReturnType<typeof passwordHealth>
  compromised: number | null
  loading: boolean
  onSelect: (item: VaultItem) => void
  onNavigate: (view: DashboardView) => void
  onToggleFavorite: (item: VaultItem) => void
}) {
  const counts = categoryCounts(items)
  const recent = recentItems(items)
  const score = securityScore(health, compromised ?? 0)
  const status = healthLabel(score)
  const categories: Array<{ id: DashboardView; label: string; count: number; icon: typeof KeyRound }> = [
    { id: 'login', label: 'Logins', count: counts.login, icon: KeyRound },
    { id: 'secureNote', label: 'Secure notes', count: counts.secureNote, icon: FileText },
    { id: 'card', label: 'Cards', count: counts.card, icon: CreditCard },
    { id: 'identity', label: 'Identities', count: counts.identity, icon: IdCard },
    { id: 'totp', label: 'Authenticator', count: counts.totp, icon: Fingerprint },
    { id: 'archive', label: 'Archive', count: counts.archive, icon: Archive },
  ]
  if (loading) return <section className="dashboard-skeleton" aria-label="Loading vault overview">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</section>
  return <section className="vault-dashboard" aria-label="Vault overview">
    <div className="dashboard-summary-grid">
      <article className="dashboard-card status-card"><span>Vault status</span><b>Fully protected</b><p>All data is end-to-end encrypted and stored securely.</p><ShieldCheck aria-hidden="true" /></article>
      <article className="dashboard-card protected-card"><span>Protected items</span><b>{items.length}</b><p>Across {Object.values(counts).filter(Boolean).length} categories</p><div className="summary-progress"><i style={{ width: `${Math.max(8, Math.min(100, items.length))}%` }} /></div><small><i /> Last sync: just now</small><Layers3 aria-hidden="true" /></article>
      <article className="dashboard-card score-card"><span>Security score</span><div className="score-content"><b>{score}</b><em className={status.tone}>{status.label}</em></div><div className="score-ring" style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}><ShieldCheck /></div><button onClick={() => onNavigate('health')}>See how to make it stronger</button></article>
      <article className="dashboard-card health-status-card"><span>Password health</span><b className={status.tone}>{status.label}</b><p>{health.weak + health.reused + (compromised ?? 0)} weak, reused or compromised findings</p><button onClick={() => onNavigate('health')}>View details</button><HeartPulse aria-hidden="true" /></article>
    </div>
    <div className="dashboard-content-grid">
      <article className="dashboard-panel recent-panel"><header><h2>Recent items</h2><button onClick={() => document.getElementById('complete-vault-list')?.scrollIntoView({ behavior: 'smooth' })}>View all</button></header>{recent.length ? <div>{recent.map((item) => { const Icon = typeIcons[item.type]; const secondary = String(item.fields.username ?? item.fields.email ?? item.fields.account ?? item.fields.cardholder ?? item.type); return <div className="recent-row" key={item.id}><button className="recent-main" onClick={() => onSelect(item)}><span><Icon size={17} /></span><span><b>{item.name}</b><small>{secondary}</small></span><time>{relativeTime(item.updatedAt)}</time></button><button className={`recent-favorite ${item.favorite ? 'active' : ''}`} onClick={() => onToggleFavorite(item)} aria-label={`${item.favorite ? 'Remove' : 'Add'} ${item.name} ${item.favorite ? 'from' : 'to'} favorites`}><Star size={16} fill={item.favorite ? 'currentColor' : 'none'} /></button></div>})}</div> : <div className="dashboard-empty"><KeyRound /><b>No items yet</b><p>Your recently updated records will appear here.</p></div>}</article>
      <article className="dashboard-panel categories-panel"><header><h2>Categories</h2><span>{items.length} total</span></header><div className="category-grid">{categories.map(({ id, label, count, icon: Icon }) => <button key={id} onClick={() => onNavigate(id)}><Icon size={18} /><b>{label}</b><small>{count} {count === 1 ? 'item' : 'items'}</small></button>)}</div></article>
      <article className="dashboard-panel health-overview"><header><h2>Password health overview</h2></header><div className="health-chart-row"><div className="health-donut" style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}><b>{health.total}</b><small>Total</small></div><dl><div><dt><i className="weak" />Weak</dt><dd>{health.weak}</dd></div><div><dt><i className="reused" />Reused</dt><dd>{health.reused}</dd></div><div><dt><i className="compromised" />Compromised</dt><dd>{compromised ?? '—'}</dd></div><div><dt><i className="strong" />Strong</dt><dd>{health.strong}</dd></div></dl></div><div className={`health-guidance ${status.tone}`}><ShieldCheck size={17} /><p><b>{status.label}</b><span>{score >= 85 ? 'Your vault has strong password coverage.' : 'Review the findings to strengthen your vault.'}</span></p></div><button className="health-open" onClick={() => onNavigate('health')}>View password health</button></article>
    </div>
    <article className="security-priority-banner"><span><ShieldCheck size={27} /></span><div><b>Your security is our priority</b><p>Zero-knowledge encryption means only you can access your data. Not even we can see it.</p></div><div className="safe-art" aria-hidden="true"><ShieldCheck /></div></article>
  </section>
}
