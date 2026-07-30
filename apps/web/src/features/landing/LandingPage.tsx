import { ArrowRight, CheckCircle2, DatabaseZap, FileKey2, Github, KeyRound, LockKeyhole, MonitorSmartphone, Moon, ServerCog, ShieldCheck, Sparkles, Sun, Twitter } from 'lucide-react'
import { brand } from '@keywall/brand'
import { Logo } from '../../ui/Logo'
import heroImage from '../../assets/keywall-hero.png'

const trustPoints = [
  { icon: FileKey2, visual: 'vault', title: 'Client-side encryption', copy: 'Vault items, attachments, and recovery material are encrypted on your device before anything leaves it.' },
  { icon: ServerCog, visual: 'stack', title: 'Ciphertext-only service', copy: 'The API stores opaque IDs, revisions, nonces, ciphertext, timestamps, and tombstones - never your keys.' },
  { icon: DatabaseZap, visual: 'devices', title: 'Local-first reads', copy: 'An encrypted IndexedDB cache keeps the app fast and useful even when the network is unavailable.' },
]

const securityModel = [
  'Master passwords and vault keys never leave the browser.',
  'Argon2id, HKDF, and AES-256-GCM separate authentication from vault wrapping.',
  'Recovery needs the offline recovery key; email alone cannot decrypt a vault.',
  'Compromised-password checks are opt-in and use k-anonymous range queries.',
]

const releaseGates = [
  'Independent cryptographic design review',
  'External penetration test',
  'Cross-browser extension and passkey automation',
  'Store packaging with production extension IDs',
]

export function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Public">
        <Logo light />
        <div>
          <a href="#product">Product</a>
          <a href="#security">Security</a>
          <a href="#docs">Docs</a>
          <a href="#enterprise">Enterprise</a>
          <a href="#pricing">Pricing</a>
          <a href="/app">Sign in</a>
          <a href="#beta">Beta status</a>
          <a className="landing-nav-action" href="/app">
            {brand.copy.launchCta}
            <ArrowRight size={15} />
          </a>
        </div>
      </nav>

      <section id="product" className="landing-hero">
        <img className="landing-hero-image" src={heroImage} alt="" aria-hidden="true" />

        <div className="landing-hero-content">
          <p className="eyebrow">{brand.copy.betaLabel}</p>
          <h1>
            Keys stay on your device. <span>Servers never see your secrets.</span>
          </h1>
          <p>{brand.productName} keeps encryption keys client-side. Servers only synchronize ciphertext.</p>
          <div className="landing-actions">
            <a className="primary-button" href="/app">
              {brand.copy.launchCta}
              <ArrowRight size={16} />
            </a>
            <a className="secondary-button landing-secondary" href="/app?mode=register">
              {brand.copy.createAccountCta}
            </a>
          </div>
          <div className="landing-pills" aria-label="Security guarantees">
            <span>
              <FileKey2 size={14} /> Client-side encryption
            </span>
            <span>
              <ServerCog size={14} /> Zero-knowledge sync
            </span>
            <span>
              <ShieldCheck size={14} /> Private by design
            </span>
          </div>
        </div>
      </section>

      <section id="security" className="landing-section landing-trust">
        <div className="landing-section-head">
          <div>
            <p className="eyebrow">Security architecture</p>
            <h2>
              Built around a simple truth: <span>only you</span> can read your data.
            </h2>
          </div>
          <p>{brand.productName} is designed so the server cannot access your keys - by architecture, not by promise.</p>
        </div>

        <div className="landing-trust-grid">
          {trustPoints.map(({ icon: Icon, visual, title, copy }) => (
            <article key={title}>
              <Icon size={21} />
              <div className={`landing-card-art ${visual}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </div>

              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-model">
        <div>
          <p className="eyebrow">What stays private</p>
          <h2>
            Secrets are decrypted only <span>inside the app session.</span>
          </h2>
        </div>
        <ul>
          {securityModel.map((item) => (
            <li key={item}>
              <CheckCircle2 size={17} />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section id="beta" className="landing-section landing-beta">
        <div className="landing-beta-status">
          <div>
            <p className="eyebrow">Release boundary</p>
            <h2>
              Private beta. Not public. <span>By design.</span>
            </h2>
            <p>
              {brand.productName} can be run as a controlled beta after deployment secrets, TLS, backups, monitoring, and domains are configured. Public launch stays blocked until the remaining security gates close.
            </p>
          </div>
        </div>
        <div className="landing-gates">
          {releaseGates.map((gate) => (
            <span key={gate}>
              <LockKeyhole size={14} />
              {gate}
            </span>
          ))}
        </div>
      </section>

      <section className="landing-section landing-faq">
        <article>
          <ShieldCheck size={19} />
          <h3>Do cloud providers see vault secrets?</h3>
          <p>No. They receive encrypted records and operational metadata, not decrypted vault fields or vault keys.</p>
        </article>
        <article>
          <KeyRound size={19} />
          <h3>Can email reset a lost vault?</h3>
          <p>No. Account recovery requires the offline recovery key that independently wraps the vault key.</p>
        </article>
      </section>

      <section id="enterprise" className="landing-final">
        <div>
          <h2>Your keys. Your rules.</h2>
          <p>Join the beta and experience private, client-side encryption done right.</p>
        </div>
        <div>
          <a className="primary-button" href="/app">
            Launch {brand.productName}
            <ArrowRight size={16} />
          </a>
          <a className="secondary-button landing-secondary" href="/app?mode=register">
            {brand.copy.createAccountCta}
          </a>
        </div>
      </section>

      <footer className="landing-footer">
        <Logo light />
        <nav aria-label="Footer">
          <a id="docs" href="/docs">
            Docs
          </a>
          <a href="#security">Security</a>
          <a href="#privacy">Privacy</a>
          <a href="#status">Status</a>
          <a id="pricing" href="#beta">
            Pricing
          </a>
        </nav>
        <div aria-label="Social links">
          <Github size={18} />
          <Twitter size={18} />
          <MonitorSmartphone size={18} />
          <Sparkles size={18} />
          <Moon size={18} />
          <Sun size={18} />
        </div>
      </footer>
    </main>
  )
}
