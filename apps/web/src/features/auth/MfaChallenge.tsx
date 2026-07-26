import { useState, type FormEvent } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { Fingerprint, KeyRound, ShieldCheck } from 'lucide-react'
import {
  completeTotpMfa,
  completeWebAuthnMfa,
  webAuthnMfaOptions,
  type BrowserSession,
  type MfaLoginChallenge,
} from '../../api'
import { readableError } from '../../errors'

export function MfaChallenge({ challenge, onComplete, onCancel }: {
  challenge: MfaLoginChallenge
  onComplete: (session: BrowserSession) => Promise<void>
  onCancel: () => void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submitTotp = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError('')
    try { await onComplete(await completeTotpMfa(challenge.mfaToken, code.trim().toUpperCase())) }
    catch (cause) { setError(readableError(cause)); setBusy(false) }
  }

  const submitPasskey = async () => {
    setBusy(true); setError('')
    try {
      const { options } = await webAuthnMfaOptions(challenge.mfaToken)
      const response = await startAuthentication({ optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON })
      await onComplete(await completeWebAuthnMfa(challenge.mfaToken, response))
    } catch (cause) { setError(readableError(cause)); setBusy(false) }
  }

  return <section className="auth-card production-auth-card">
    <div className="auth-icon"><ShieldCheck size={25} /></div>
    <p className="eyebrow">Second factor</p><h1>Verify it’s you</h1>
    <p className="auth-copy">Complete multi-factor authentication before this device can decrypt your vault.</p>
    {challenge.methods.includes('totp') && <form onSubmit={submitTotp}>
      <label className="field-label" htmlFor="mfa-code">Authenticator or recovery code</label>
      <div className="input-wrap"><KeyRound size={18} /><input id="mfa-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456 or ABCD-EFGH" autoComplete="one-time-code" required /></div>
      <button className="primary-button full" disabled={busy || code.length < 6}>Verify code</button>
    </form>}
    {challenge.methods.includes('webauthn') && <button className="primary-button full" disabled={busy} onClick={() => void submitPasskey()}><Fingerprint size={17} /> Use a passkey</button>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="forgot-link" disabled={busy} onClick={onCancel}>Cancel sign in</button>
  </section>
}
