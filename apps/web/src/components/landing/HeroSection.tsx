import { ArrowRight, CreditCard, FileText, KeyRound, Lock, RefreshCw, Search, Shield, Sliders, Smartphone, Laptop, Tablet, Monitor } from 'lucide-react'
import { brand } from '@keywall/brand'
import { SectionBadge } from './SectionBadge'
import { PrimaryButton } from './PrimaryButton'
import { FadeIn } from '../../lib/FadeIn'
import { StaggerContainer, StaggerItem } from '../../lib/StaggerContainer'
import { TextReveal } from '../../lib/TextReveal'

export function HeroSection() {
  return (
    <section id="product" className="kw-hero-section">
      <div className="landing-container">
        {/* Hero Header */}
        <div className="kw-hero-header">
          <FadeIn delay={0.05} distance={16}>
            <SectionBadge>{brand.copy.betaLabel}</SectionBadge>
          </FadeIn>

          <TextReveal
            as="h1"
            className="kw-hero-title"
            delay={0.15}
            segments={[
              'Keys stay on your device.',
              <br key="br" />,
              <span key="gradient" className="kw-gradient-text">Servers never see your secrets.</span>,
            ]}
          >
            {''}
          </TextReveal>

          <FadeIn delay={0.55} distance={18}>
            <p className="kw-hero-subtitle">
              Keywall keeps encryption keys client-side.<br />
              Servers only synchronize ciphertext.
            </p>
          </FadeIn>

          <FadeIn delay={0.7} distance={14}>
            <div className="kw-hero-actions">
              <PrimaryButton href="/app" icon={<ArrowRight size={16} />}>
                {brand.copy.launchCta}
              </PrimaryButton>
              <PrimaryButton href="/app?mode=register" variant="secondary">
                {brand.copy.createAccountCta}
              </PrimaryButton>
            </div>
          </FadeIn>
        </div>

        {/* Hero Showcase Composition */}
        <div className="kw-hero-visual-wrapper">
          {/* Ambient Glow Arc */}
          <div className="kw-hero-glow-arc" />

          <div className="kw-hero-showcase">
            {/* Left Column Floating Cards */}
            <StaggerContainer staggerDelay={0.1} className="kw-hero-side-col left">
              {/* Card 1: Secure Password Vault */}
              <StaggerItem>
                <div className="kw-hero-feature-card">
                  <div className="kw-card-header">
                    <div className="kw-icon-box">
                      <Lock size={18} />
                    </div>
                    <div>
                      <h3>Secure password vault</h3>
                      <p>Store logins, API keys, and secrets with end-to-end encryption.</p>
                    </div>
                  </div>

                  <div className="kw-card-mockup-rows">
                    <div className="kw-mockup-row">
                      <div className="kw-row-icon github">GH</div>
                      <div className="kw-row-info">
                        <span className="name">GitHub</span>
                        <span className="email">john.doe@example.com</span>
                      </div>
                      <div className="kw-row-mask">••••••••••••</div>
                    </div>
                    <div className="kw-mockup-row">
                      <div className="kw-row-icon notion">N</div>
                      <div className="kw-row-info">
                        <span className="name">Notion</span>
                        <span className="email">john.doe@example.com</span>
                      </div>
                      <div className="kw-row-mask">••••••••••••</div>
                    </div>
                  </div>
                </div>
              </StaggerItem>

              {/* Card 2: Card PINs & Sensitive Data */}
              <StaggerItem>
                <div className="kw-hero-feature-card">
                  <div className="kw-card-header">
                    <div className="kw-icon-box">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <h3>Card PINs & sensitive data</h3>
                      <p>Keep card details and PINs protected with strong encryption.</p>
                    </div>
                  </div>

                  <div className="kw-card-visa-box">
                    <div className="visa-details">
                      <span className="card-num">Visa •••• 4242</span>
                      <span className="pin">PIN ••••</span>
                    </div>
                    <span className="visa-badge">VISA</span>
                  </div>
                </div>
              </StaggerItem>
            </StaggerContainer>

            {/* Center Column: Phone Mockup */}
            <FadeIn delay={0.4} distance={32} blur scale={0.97} className="kw-hero-phone-col">
              <div className="kw-phone-frame">
                {/* Phone Notch / Status bar */}
                <div className="kw-phone-status-bar">
                  <span>9:41</span>
                  <div className="kw-phone-icons">
                    <span className="bar-icon">📶</span>
                    <span className="bar-icon">🔋</span>
                  </div>
                </div>

                {/* App Header */}
                <div className="kw-phone-app-header">
                  <h2>Keywall</h2>
                  <button className="kw-dots-btn">⋮</button>
                </div>

                {/* Search Bar */}
                <div className="kw-phone-search">
                  <Search size={14} className="search-icon" />
                  <span>Search your vault</span>
                </div>

                {/* Filter Tabs */}
                <div className="kw-phone-tabs">
                  <span className="tab active">All</span>
                  <span className="tab">Logins</span>
                  <span className="tab">Cards</span>
                  <span className="tab">Notes</span>
                  <span className="tab">Keys</span>
                </div>

                {/* Vault Items List */}
                <div className="kw-phone-item-list">
                  <div className="kw-phone-item">
                    <div className="item-icon gh">GH</div>
                    <div className="item-details">
                      <span className="item-title">GitHub</span>
                      <span className="item-sub">john.doe@example.com</span>
                    </div>
                    <span className="item-dots">⋯</span>
                  </div>

                  <div className="kw-phone-item">
                    <div className="item-icon google">G</div>
                    <div className="item-details">
                      <span className="item-title">Google Workspace</span>
                      <span className="item-sub">john.doe@example.com</span>
                    </div>
                    <span className="item-dots">⋯</span>
                  </div>

                  <div className="kw-phone-item">
                    <div className="item-icon aws">aws</div>
                    <div className="item-details">
                      <span className="item-title">AWS Console</span>
                      <span className="item-sub">john.doe@example.com</span>
                    </div>
                    <span className="item-dots">⋯</span>
                  </div>

                  <div className="kw-phone-item">
                    <div className="item-icon visa">VISA</div>
                    <div className="item-details">
                      <span className="item-title">Visa •••• 4242</span>
                      <span className="item-sub">PIN ••••</span>
                    </div>
                    <span className="item-dots">⋯</span>
                  </div>

                  <div className="kw-phone-item">
                    <div className="item-icon note">📝</div>
                    <div className="item-details">
                      <span className="item-title">Personal Note</span>
                      <span className="item-sub">Encrypted note</span>
                    </div>
                    <span className="item-dots">⋯</span>
                  </div>
                </div>

                {/* Bottom App Nav */}
                <div className="kw-phone-bottom-nav">
                  <span className="nav-item">🏠</span>
                  <div className="nav-item active-shield">
                    <Shield size={18} />
                  </div>
                  <span className="nav-item">⚙️</span>
                </div>
              </div>
            </FadeIn>

            {/* Right Column Floating Cards */}
            <StaggerContainer staggerDelay={0.1} className="kw-hero-side-col right">
              {/* Card 3: Encrypted Notes */}
              <StaggerItem>
                <div className="kw-hero-feature-card">
                  <div className="kw-card-header">
                    <div className="kw-icon-box">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3>Encrypted notes</h3>
                      <p>Write anything down. Only you can read it.</p>
                    </div>
                  </div>

                  <div className="kw-card-recovery-box">
                    <div className="code-text">
                      <span>Backup recovery codes</span>
                      <code>ed25519:7xK3...a9F2</code>
                      <code>x25519:5mN8...b3Q1</code>
                    </div>
                    <Lock size={16} className="lock-icon" />
                  </div>
                </div>
              </StaggerItem>

              {/* Card 4: Zero-Knowledge Sync */}
              <StaggerItem>
                <div className="kw-hero-feature-card">
                  <div className="kw-card-header">
                    <div className="kw-icon-box">
                      <RefreshCw size={18} />
                    </div>
                    <div>
                      <h3>Zero-knowledge sync</h3>
                      <p>Your data is encrypted on your device and synced as ciphertext across your devices.</p>
                    </div>
                  </div>

                  <div className="kw-sync-diagram">
                    <Laptop size={18} />
                    <span className="dash-line" />
                    <Smartphone size={16} />
                    <span className="dash-line" />
                    <div className="sync-lock">
                      <Lock size={12} />
                    </div>
                    <span className="dash-line" />
                    <Tablet size={16} />
                    <span className="dash-line" />
                    <Monitor size={18} />
                  </div>
                </div>
              </StaggerItem>
            </StaggerContainer>
          </div>

          {/* Bottom Security Chips Bar */}
          <FadeIn delay={0.9} distance={12}>
            <div className="kw-hero-chips-bar">
              <KeyRound size={14} className="chip-icon" />
              <span>Client-side encryption</span>
              <span className="chip-dot">•</span>
              <span>Zero-knowledge by design</span>
              <span className="chip-dot">•</span>
              <span>Private by default</span>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
