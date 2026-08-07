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

  if (loading) {
    return (
      <section className="dashboard-skeleton" aria-label="Loading vault overview">
        {Array.from({ length: 4 }, (_, index) => (
          <i key={index} />
        ))}
      </section>
    )
  }

  return (
    <section className="vault-dashboard" aria-label="Vault overview">
      {/* Top 3 Hero Metric Cards */}
      <motion.div className="dashboard-summary-grid" variants={cardContainer} initial="hidden" animate="visible">
        <motion.article variants={cardItem} className="dashboard-card metrics-hero-card">
          <div className="card-top-row">
            <span className="card-eyebrow">Vault items</span>
            <Layers3 className="card-icon" aria-hidden="true" size={20} />
          </div>
          <b className="card-metric-val">{items.length}</b>
          <p className="card-subtext">Across {Object.values(counts).filter(Boolean).length} item categories</p>
        </motion.article>

        <motion.article variants={cardItem} className="dashboard-card metrics-hero-card">
          <div className="card-top-row">
            <span className="card-eyebrow">Security Score</span>
            <ShieldCheck className="card-icon" aria-hidden="true" size={20} />
          </div>
          <div className="score-metric-row">
            <b className="card-metric-val">{score}</b>
            <span className={`score-badge ${status.tone}`}>{status.label}</span>
          </div>
          <p className="card-subtext">{health.weak + health.reused + (compromised ?? 0)} items need attention</p>
        </motion.article>

        <motion.article variants={cardItem} className="dashboard-card metrics-hero-card">
          <div className="card-top-row">
            <span className="card-eyebrow">Encryption & Sync</span>
            <span className="live-status-pill">Zero-Knowledge</span>
          </div>
          <b className="card-metric-val status-title">Protected</b>
          <p className="card-subtext">Client-side AES-256-GCM encryption active</p>
        </motion.article>
      </motion.div>

      {/* Main 2-Column Dashboard Workspace */}
      <motion.div className="dashboard-main-layout" variants={cardContainer} initial="hidden" animate="visible">
        {/* Left Column: Recent Activity */}
        <motion.article variants={cardItem} className="dashboard-panel recent-panel">
          <header className="panel-header">
            <div>
              <h2>Recent items</h2>
              <p className="panel-sub">Recently accessed and updated vault records</p>
            </div>
            {recent.length > 0 && (
              <button className="panel-text-btn" onClick={() => document.getElementById('complete-vault-list')?.scrollIntoView({ behavior: 'smooth' })}>
                View all items
              </button>
            )}
          </header>

          {recent.length ? (
            <div className="recent-items-list">
              {recent.map((item) => {
                const Icon = typeIcons[item.type]
                return (
                  <div className="recent-row" key={item.id}>
                    <button className="recent-main-btn" onClick={() => onSelect(item)}>
                      <span className="item-icon-box">
                        <Icon size={16} />
                      </span>
                      <div className="item-info">
                        <b className="item-name">{item.name}</b>
                        <small className="item-sub">{safeSubtitle(item)}</small>
                      </div>
                      <time className="item-time">{relativeTime(item.updatedAt)}</time>
                    </button>
                    <button
                      className={`favorite-action-btn ${item.favorite ? 'is-favorite' : ''}`}
                      onClick={() => onToggleFavorite(item)}
                      aria-label={`${item.favorite ? 'Remove' : 'Add'} ${item.name} ${item.favorite ? 'from' : 'to'} favorites`}
                    >
                      <Star size={15} fill={item.favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <KeyRound size={28} />
              <b>No vault items yet</b>
              <p>Items you add or import will appear here for quick access.</p>
            </div>
          )}
        </motion.article>

        {/* Right Column: Password Health Breakdown */}
        <motion.article variants={cardItem} className="dashboard-panel health-panel">
          <header className="panel-header">
            <div>
              <h2>Password health</h2>
              <p className="panel-sub">Local security analysis</p>
            </div>
            <button className="panel-action-btn" onClick={() => onNavigate('health')}>
              Inspect
            </button>
          </header>

          <div className="health-chart-body">
            <div className="health-stat-list">
              <div className="stat-row">
                <span className="stat-dot strong" />
                <span className="stat-label">Strong passwords</span>
                <span className="stat-val">{health.strong}</span>
              </div>
              <div className="stat-row">
                <span className="stat-dot weak" />
                <span className="stat-label">Weak passwords</span>
                <span className="stat-val">{health.weak}</span>
              </div>
              <div className="stat-row">
                <span className="stat-dot reused" />
                <span className="stat-label">Reused passwords</span>
                <span className="stat-val">{health.reused}</span>
              </div>
              <div className="stat-row">
                <span className="stat-dot compromised" />
                <span className="stat-label">Compromised logins</span>
                <span className="stat-val">{compromised ?? '-'}</span>
              </div>
            </div>

            <div className={`health-status-box ${status.tone}`}>
              <HeartPulse size={16} />
              <div>
                <b>{status.label}</b>
                <p>{score >= 85 ? 'Vault passwords meet strong security standards.' : 'Review login health to resolve vulnerable passwords.'}</p>
              </div>
            </div>
          </div>
        </motion.article>
      </motion.div>
    </section>
  )
}

