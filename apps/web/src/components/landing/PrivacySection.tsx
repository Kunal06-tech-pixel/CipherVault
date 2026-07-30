import { ChevronRight, EyeOff, Key, Lock, RefreshCw, Shield, ShieldCheck } from 'lucide-react'
import { SectionBadge } from './SectionBadge'

const privacyItems = [
  {
    icon: Key,
    text: 'Master passwords and vault keys never leave the browser.',
  },
  {
    icon: ShieldCheck,
    text: 'Argon2id, HKDF, and AES-256-GCM separate authentication from vault wrapping.',
  },
  {
    icon: RefreshCw,
    text: 'Recovery needs the offline recovery key; email alone cannot decrypt a vault.',
  },
  {
    icon: EyeOff,
    text: 'Compromised-password checks are opt-in and use k-anonymous range queries.',
  },
]

export function PrivacySection() {
  return (
    <section id="privacy" className="kw-section kw-privacy-section">
      <div className="landing-container kw-privacy-grid">
        {/* Left Side Info */}
        <div className="kw-privacy-left">
          <SectionBadge>WHAT STAYS PRIVATE</SectionBadge>
          <h2 className="kw-privacy-title">
            Secrets are decrypted only{' '}
            <span className="kw-gradient-text">inside the app session.</span>
          </h2>
          <p className="kw-privacy-subtitle">
            Keywall is built with zero-knowledge by design.<br />
            Your data stays protected—end to end.
          </p>

          <div className="kw-privacy-control-badge">
            <div className="icon-circle">
              <ShieldCheck size={18} />
            </div>
            <span>You stay in control. Always.</span>
          </div>
        </div>

        {/* Right Side Visual & List */}
        <div className="kw-privacy-right">
          {/* Top Session Window Graphic */}
          <div className="kw-session-graphic-card">
            <div className="window-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>

            <div className="session-shield-container">
              <div className="aura-ring outer" />
              <div className="aura-ring inner" />
              <div className="shield-box">
                <Shield size={44} className="shield-bg-icon" />
                <Lock size={20} className="shield-lock-icon" />
              </div>

              <div className="session-status-tag">
                <span className="purple-dot">●</span>
                <span>Decrypted in this session</span>
              </div>
            </div>
          </div>

          {/* 4 List Cards */}
          <div className="kw-privacy-list">
            {privacyItems.map((item, idx) => {
              const IconComp = item.icon
              return (
                <div key={idx} className="kw-privacy-item-card">
                  <div className="item-icon-box">
                    <IconComp size={18} />
                  </div>
                  <span className="item-text">{item.text}</span>
                  <ChevronRight size={18} className="item-arrow" />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
