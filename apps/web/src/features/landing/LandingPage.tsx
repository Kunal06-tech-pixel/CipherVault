import { ArrowRight, CheckCircle2, DatabaseZap, FileKey2, KeyRound, LockKeyhole, ServerCog, ShieldCheck, TriangleAlert } from 'lucide-react'
import { brand } from '@keywall/brand'
import { Logo } from '../../ui/Logo'

const trustPoints = [
  { icon: FileKey2, title: 'Client-side encryption', copy: 'Vault items, attachments, and recovery material are encrypted before sync.' },
  { icon: ServerCog, title: 'Ciphertext-only service', copy: 'The API stores opaque IDs, revisions, nonces, ciphertext, timestamps, and tombstones.' },
  { icon: DatabaseZap, title: 'Local-first reads', copy: 'An encrypted IndexedDB cache keeps the app useful when the network is unavailable.' },
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
  return <main className="landing-page">
    <nav className="landing-nav" aria-label="Public">
      <Logo light />
      <div>
        <a href="#security">Security</a>
        <a href="#beta">Beta status</a>
        <a className="landing-nav-action" href="/app">Launch app</a>
      </div>
    </nav>

    <section className="landing-hero">
      <div className="landing-hero-visual" aria-hidden="true">
        <div className="vault-preview-shell">
          <div className="preview-sidebar">
            <span />
            <i />
            <i />
            <i />
          </div>
          <div className="preview-main">
            <div className="preview-topline"><span /><span /></div>
            <div className="preview-metrics">
              <i /><i /><i />
            </div>
            <div className="preview-list">
              <span /><span /><span /><span />
            </div>
          </div>
        </div>
      </div>
      <div className="landing-hero-content">
        <p className="eyebrow">{brand.copy.betaLabel}</p>
        <h1>{brand.productName}</h1>
        <p>{brand.copy.privacyClaim}</p>
        <div className="landing-actions">
          <a className="primary-button" href="/app">{brand.copy.launchCta}<ArrowRight size={16} /></a>
          <a className="secondary-button landing-secondary" href="/app?mode=register">{brand.copy.createAccountCta}</a>
        </div>
      </div>
    </section>

    <section id="security" className="landing-section landing-trust">
      <div className="landing-section-head">
        <p className="eyebrow">Security architecture</p>
        <h2>Built around keys the server cannot read.</h2>
      </div>
      <div className="landing-trust-grid">
        {trustPoints.map(({ icon: Icon, title, copy }) => <article key={title}>
          <Icon size={21} />
          <h3>{title}</h3>
          <p>{copy}</p>
        </article>)}
      </div>
    </section>

    <section className="landing-section landing-model">
      <div>
        <p className="eyebrow">What stays private</p>
        <h2>Secrets are decrypted only inside the app session.</h2>
      </div>
      <ul>
        {securityModel.map((item) => <li key={item}><CheckCircle2 size={17} />{item}</li>)}
      </ul>
    </section>

    <section id="beta" className="landing-section landing-beta">
      <div className="landing-beta-status">
        <TriangleAlert size={20} />
        <div>
          <p className="eyebrow">Release boundary</p>
          <h2>Private beta, not public general availability.</h2>
          <p>{brand.productName} can be run as a controlled beta after deployment secrets, TLS, backups, monitoring, and domains are configured. Public launch stays blocked until the remaining security gates close.</p>
        </div>
      </div>
      <div className="landing-gates">
        {releaseGates.map((gate) => <span key={gate}><LockKeyhole size={14} />{gate}</span>)}
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
  </main>
}
