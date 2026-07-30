import { Lock, ShieldCheck, Database, Key, Wifi, Server, Laptop, Smartphone } from 'lucide-react'
import { brand } from '@keywall/brand'
import { SectionBadge } from './SectionBadge'

export function SecurityArchitectureSection() {
  return (
    <section id="security" className="kw-section kw-security-section">
      <div className="landing-container">
        {/* Header */}
        <div className="kw-section-header">
          <SectionBadge>SECURITY ARCHITECTURE</SectionBadge>
          <h2 className="kw-section-title">
            Built around a simple truth:<br />
            <span className="kw-gradient-text">only you</span> can read your data.
          </h2>
          <p className="kw-section-subtitle">
            Server-side systems only store ciphertext and metadata.<br />
            Your keys stay under your control.
          </p>
        </div>

        {/* 3 Architecture Cards */}
        <div className="kw-sec-grid">
          {/* Card 1: Client-Side Encryption */}
          <div className="kw-card kw-sec-card">
            <div className="kw-card-visual vault-visual">
              <div className="visual-top-bar">
                <div className="window-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>
                <span className="window-title">Keywall Vault</span>
              </div>
              <div className="visual-body vault-body">
                <div className="vault-sidebar">
                  <div className="active-item">🏢 All items</div>
                  <div>🔑 Passwords</div>
                  <div>📝 Secure Notes</div>
                  <div>📄 Documents</div>
                  <div>🔢 TOTP Codes</div>
                  <div>🪪 Identities</div>
                </div>
                <div className="vault-content">
                  <div className="glowing-lock-circle">
                    <Lock size={28} />
                  </div>
                  <div className="status-indicator">
                    Local encryption: <span className="green-dot">•</span> Active
                  </div>
                  <p className="sub-text">Your data is encrypted on this device</p>
                  <button className="lock-btn">🔒 Lock Vault</button>
                </div>
              </div>
            </div>

            <div className="kw-card-content">
              <h3>Client-side encryption</h3>
              <p>
                Vault items, attachments, and recovery material are encrypted on your device before anything leaves it.
              </p>
              <div className="kw-card-chip">
                <ShieldCheck size={14} />
                <span>Keys never leave your device</span>
              </div>
            </div>
          </div>

          {/* Card 2: Ciphertext-Only Service */}
          <div className="kw-card kw-sec-card">
            <div className="kw-card-visual api-visual">
              <div className="visual-top-bar">
                <span className="window-title">Keywall API</span>
                <span className="healthy-badge">● Healthy</span>
              </div>
              <div className="visual-body api-body">
                <table className="api-table">
                  <thead>
                    <tr>
                      <th>Item ID</th>
                      <th>Nonce</th>
                      <th>Revision</th>
                      <th>Ciphertext</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>a7f3e9c2...</td>
                      <td>8f1a2b3c...</td>
                      <td>12</td>
                      <td className="code-col">AEAD: xG7k...</td>
                    </tr>
                    <tr>
                      <td>c91d4b77...</td>
                      <td>9c2b7d1a...</td>
                      <td>7</td>
                      <td className="code-col">AEAD: bN4s...</td>
                    </tr>
                    <tr>
                      <td>e3fb2a19f...</td>
                      <td>d5e6f2a1...</td>
                      <td>3</td>
                      <td className="code-col">AEAD: m2Qp...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="kw-card-content">
              <h3>Ciphertext-only service</h3>
              <p>
                The API stores opaque IDs, revisions, nonces, timestamps, and ciphertexts — never your keys or plaintext.
              </p>
              <div className="kw-card-chip">
                <Lock size={14} />
                <span>Zero visibility into your data</span>
              </div>
            </div>
          </div>

          {/* Card 3: Local-First Reads */}
          <div className="kw-card kw-sec-card">
            <div className="kw-card-visual offline-visual">
              <div className="visual-top-bar">
                <span className="window-title">Keywall App</span>
                <span className="offline-badge">● Offline <small>Local cache active</small></span>
              </div>
              <div className="visual-body offline-body">
                <div className="devices-mockup">
                  <div className="laptop-screen">
                    <Laptop size={36} />
                    <div className="screen-tag">Keywall Local</div>
                  </div>
                  <div className="phone-screen">
                    <Smartphone size={24} />
                    <div className="offline-pill">Offline</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="kw-card-content">
              <h3>Local-first reads</h3>
              <p>
                An encrypted IndexedDB cache keeps the app fast and useful even when the network is unavailable.
              </p>
              <div className="kw-card-chip">
                <Wifi size={14} />
                <span>Works anywhere, even offline</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Feature Pills */}
        <div className="kw-sec-bottom-pills">
          <div className="kw-bottom-pill">
            <Key size={16} />
            <span>Device-generated keys</span>
          </div>
          <div className="kw-bottom-pill">
            <Database size={16} />
            <span>Opaque metadata</span>
          </div>
          <div className="kw-bottom-pill">
            <Wifi size={16} />
            <span>Offline-ready</span>
          </div>
        </div>
      </div>
    </section>
  )
}
