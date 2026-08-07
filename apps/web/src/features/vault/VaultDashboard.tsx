import { motion, type Variants } from 'framer-motion'
import { Archive, HeartPulse, KeyRound, Layers3, ShieldCheck, Star } from 'lucide-react'
import type { VaultItem } from '@keywall/contracts'
import * as React from 'react'
import type { passwordHealth } from '../../health'
import { dashboardTypeOrder, typeIcons, typeLabels } from './item-types'
import { categoryCounts, healthLabel, recentItems, relativeTime, securityScore } from './dashboard-metrics'
import { safeSubtitle } from './vault-item-validation'
import type { View } from './VaultScreen'
import { easeOut } from '../../lib/motion'

type DashboardView = Extract<View, VaultItem['type'] | 'archive' | 'health'>

const cardContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const cardItem: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.35, ease: easeOut } },
}

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
    ...dashboardTypeOrder.map((id) => ({ id, label: typeLabels[id], count: counts[id], icon: typeIcons[id] })),
    { id: 'archive', label: 'Archive', count: counts.archive, icon: Archive },
  ]

  if (loading) {
    return <section className="dashboard-skeleton" aria-label="Loading vault overview">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</section>
  }

  return <section className="vault-dashboard" aria-label="Vault overview">
    <motion.div className="dashboard-summary-grid" variants={cardContainer} initial="hidden" animate="visible">
      <motion.article variants={cardItem} className="dashboard-card status-card"><span>Vault status</span><b>Fully protected</b><p>All vault content is encrypted before synchronization.</p><ShieldCheck aria-hidden="true" /></motion.article>
      <motion.article variants={cardItem} className="dashboard-card protected-card"><span>Protected items</span><b>{items.length}</b><p>Across {Object.values(counts).filter(Boolean).length} secure item groups</p><div className="summary-progress"><i style={{ width: `${Math.max(8, Math.min(100, items.length))}%` }} /></div><small><i /> Last sync: just now</small><Layers3 aria-hidden="true" /></motion.article>
      <motion.article variants={cardItem} className="dashboard-card score-card"><span>Login security score</span><div className="score-content"><b>{score}</b><em className={status.tone}>{status.label}</em></div><div className="score-ring" style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}><ShieldCheck /></div><button onClick={() => onNavigate('health')}>Review login health</button></motion.article>
      <motion.article variants={cardItem} className="dashboard-card health-status-card"><span>Login health</span><b className={status.tone}>{status.label}</b><p>{health.weak + health.reused + (compromised ?? 0)} weak, reused or compromised login findings</p><button onClick={() => onNavigate('health')}>View details</button><HeartPulse aria-hidden="true" /></motion.article>
    </motion.div>
    <motion.div className="dashboard-content-grid" variants={cardContainer} initial="hidden" animate="visible">
      <motion.article variants={cardItem} className="dashboard-panel recent-panel">
        <header><h2>Recent items</h2><button onClick={() => document.getElementById('complete-vault-list')?.scrollIntoView({ behavior: 'smooth' })}>View all</button></header>
        {recent.length ? <div>{recent.map((item) => {
          const Icon = typeIcons[item.type]
          return <div className="recent-row" key={item.id}>
            <button className="recent-main" onClick={() => onSelect(item)}><span><Icon size={17} /></span><span><b>{item.name}</b><small>{safeSubtitle(item)}</small></span><time>{relativeTime(item.updatedAt)}</time></button>
            <button className={`recent-favorite ${item.favorite ? 'active' : ''}`} onClick={() => onToggleFavorite(item)} aria-label={`${item.favorite ? 'Remove' : 'Add'} ${item.name} ${item.favorite ? 'from' : 'to'} favorites`}><Star size={16} fill={item.favorite ? 'currentColor' : 'none'} /></button>
          </div>
        })}</div> : <div className="dashboard-empty"><KeyRound /><b>No items yet</b><p>Your recently updated records will appear here.</p></div>}
      </motion.article>
      <motion.article variants={cardItem} className="dashboard-panel categories-panel"><header><h2>Item types</h2><span>{items.length} total</span></header><div className="category-grid">{categories.map(({ id, label, count, icon: Icon }) => <button key={id} onClick={() => onNavigate(id)}><Icon size={18} /><b>{label}</b><small>{count} {count === 1 ? 'item' : 'items'}</small></button>)}</div></motion.article>
      <motion.article variants={cardItem} className="dashboard-panel health-overview"><header><h2>Login health overview</h2></header><div className="health-chart-row"><div className="health-donut" style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}><b>{health.total}</b><small>Logins</small></div><dl><div><dt><i className="weak" />Weak</dt><dd>{health.weak}</dd></div><div><dt><i className="reused" />Reused</dt><dd>{health.reused}</dd></div><div><dt><i className="compromised" />Compromised</dt><dd>{compromised ?? '-'}</dd></div><div><dt><i className="strong" />Strong</dt><dd>{health.strong}</dd></div></dl></div><div className={`health-guidance ${status.tone}`}><ShieldCheck size={17} /><p><b>{status.label}</b><span>{score >= 85 ? 'Your login credentials have strong password coverage.' : 'Review the login findings to strengthen your vault.'}</span></p></div><button className="health-open" onClick={() => onNavigate('health')}>View login health</button></motion.article>
    </motion.div>
    <article className="security-priority-banner"><span><ShieldCheck size={27} /></span><div><b>Your security is our priority</b><p>The server stores ciphertext only. Decrypted values remain on this device while the vault is unlocked.</p></div><div className="safe-art" aria-hidden="true"><ShieldCheck /></div></article>
  </section>
}
