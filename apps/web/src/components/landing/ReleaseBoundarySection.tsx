import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { AppWindow, ChevronDown, Lock, Package, Shield, ShieldCheck, Target } from 'lucide-react'
import { brand } from '@keywall/brand'
import { SectionBadge } from './SectionBadge'
import { FadeIn } from '../../lib/FadeIn'
import { StaggerContainer, StaggerItem } from '../../lib/StaggerContainer'
import { easeOut } from '../../lib/motion'

const gates = [
  {
    id: 1,
    icon: ShieldCheck,
    title: 'Independent cryptographic design review',
    desc: 'Validated by a third-party cryptography expert.',
    details: 'Full cryptographic verification covering key exchange, Argon2id derivation, and AES-256-GCM authenticated ciphertexts.',
    status: 'PENDING',
  },
  {
    id: 2,
    icon: Target,
    title: 'External penetration test',
    desc: 'Full-scope application and infrastructure assessment.',
    details: 'Comprehensive security evaluation targeting API endpoints, web extension bridge, and server-side storage mechanics.',
    status: 'PENDING',
  },
  {
    id: 3,
    icon: AppWindow,
    title: 'Cross-browser extension and passkey automation',
    desc: 'Verified across supported browsers and passkey flows.',
    details: 'Automated test suite passing on Chrome, Firefox, Safari, and Edge with WebAuthn L2/L3 passkey support.',
    status: 'PENDING',
  },
  {
    id: 4,
    icon: Package,
    title: 'Store packaging with production extension IDs',
    desc: 'Production-ready build with fixed extension identifiers.',
    details: 'Final Chrome Web Store and Firefox Add-ons manifests prepared with strict Web extension permissions.',
    status: 'PENDING',
  },
]

export function ReleaseBoundarySection() {
  const [expandedGate, setExpandedGate] = useState<number | null>(null)
  const prefersReducedMotion = useReducedMotion()

  return (
    <section id="beta" className="kw-section kw-release-section">
      <div className="landing-container kw-release-grid">
        {/* Left Side Content */}
        <FadeIn direction="right" distance={30} className="kw-release-left">
          <SectionBadge>RELEASE BOUNDARY</SectionBadge>
          <h2 className="kw-release-title">
            Private beta.<br />
            Not public.<br />
            <span className="kw-gradient-text">By design.</span>
          </h2>
          <p className="kw-release-subtitle">
            Keywall can be run as a controlled beta after deployment secrets, TLS, backups, monitoring, and domains are configured. Public launch stays blocked until the remaining security gates close.
          </p>

          <StaggerContainer staggerDelay={0.1} className="kw-release-status-pills">
            <StaggerItem>
              <div className="kw-status-pill green">
                <Lock size={14} />
                <span>Private beta enabled</span>
                <span className="dot green" />
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="kw-status-pill red">
                <Lock size={14} />
                <span>Public launch blocked</span>
                <span className="dot red" />
              </div>
            </StaggerItem>
          </StaggerContainer>
        </FadeIn>

        {/* Right Side Gate Card */}
        <FadeIn delay={0.15} scale={0.97} className="kw-release-right">
          <div className="kw-gate-card">
            {/* Gate Card Header */}
            <div className="kw-gate-header">
              <div className="header-left">
                <div className="gate-icon-box">
                  <Shield size={20} />
                </div>
                <div>
                  <h3>Release gate</h3>
                  <p>All gates must be closed to unlock public launch.</p>
                </div>
              </div>
              <div className="gate-count-badge">
                <Lock size={13} />
                <span>0 / 4 gates closed</span>
              </div>
            </div>

            {/* Gate List */}
            <div className="kw-gate-list">
              {gates.map((gate) => {
                const IconComp = gate.icon
                const isExpanded = expandedGate === gate.id

                return (
                  <div key={gate.id} className="kw-gate-item">
                    <div
                      className="gate-item-row"
                      onClick={() => setExpandedGate(isExpanded ? null : gate.id)}
                    >
                      <div className="gate-item-icon">
                        <IconComp size={18} />
                      </div>
                      <div className="gate-item-content">
                        <h4>{gate.title}</h4>
                        <p>{gate.desc}</p>
                      </div>
                      <div className="gate-item-meta">
                        <span className="pending-badge">{gate.status}</span>
                        <ChevronDown size={16} className={`chevron ${isExpanded ? 'open' : ''}`} />
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          className="gate-expanded-details"
                          initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: easeOut }}
                          style={{ overflow: 'hidden' }}
                        >
                          <p>{gate.details}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* Footer Notice */}
            <div className="kw-gate-footer">
              <Lock size={15} />
              <span>Public launch remains blocked until all gates are closed.</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
