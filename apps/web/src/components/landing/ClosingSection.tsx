import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react'
import { brand } from '@keywall/brand'
import { PrimaryButton } from './PrimaryButton'

export function ClosingSection() {
  return (
    <section className="kw-section kw-closing-section">
      <div className="landing-container">
        {/* FAQ Cards (2 side-by-side) */}
        <div className="kw-faq-grid">
          {/* FAQ Card 1 */}
          <div className="kw-card kw-faq-card">
            <div className="faq-icon-circle">
              <ShieldCheck size={22} />
            </div>
            <h3>Do cloud providers see vault secrets?</h3>
            <p>
              No. They receive encrypted records and operational metadata, not decrypted vault fields or vault keys.
            </p>
          </div>

          {/* FAQ Card 2 */}
          <div className="kw-card kw-faq-card">
            <div className="faq-icon-circle">
              <KeyRound size={22} />
            </div>
            <h3>Can email reset a lost vault?</h3>
            <p>
              No. Account recovery requires the offline recovery key that independently wraps the vault key.
            </p>
          </div>
        </div>

        {/* Final CTA Banner */}
        <div className="kw-final-cta-card">
          <div className="cta-content">
            <h2>Your keys. Your rules.</h2>
            <p>Join the beta and experience private, client-side encryption done right.</p>
          </div>

          <div className="cta-actions">
            <PrimaryButton href="/app" icon={<ArrowRight size={16} />}>
              Launch {brand.productName}
            </PrimaryButton>
            <PrimaryButton href="/app?mode=register" variant="secondary">
              {brand.copy.createAccountCta}
            </PrimaryButton>
          </div>

          {/* Bottom Purple Horizon Arc Glow */}
          <div className="cta-horizon-arc" />
        </div>
      </div>
    </section>
  )
}
