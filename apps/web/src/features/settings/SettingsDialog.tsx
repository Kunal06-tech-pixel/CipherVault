import { useEffect, useState } from 'react'
import { Download, Fingerprint, KeyRound, LogOut, ShieldCheck, X } from 'lucide-react'
import { startRegistration } from '@simplewebauthn/browser'
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import {
  completePasskeyEnrollment,
  confirmTotpEnrollment,
  disableMfaFactor,
  listMfaFactors,
  listSessions,
  revokeSession,
  startPasskeyEnrollment,
  startTotpEnrollment,
} from '../../api'
import { readableError } from '../../errors'

export function SettingsDialog({ onClose, onLock, onPlaintextExport, onDeleteAccount, onReauthenticate }: {
  onClose: () => void
  onLock: () => void
  onPlaintextExport: (masterPassword: string) => Promise<void>
  onDeleteAccount: (masterPassword: string, confirmationEmail: string) => Promise<void>
  onReauthenticate: (masterPassword: string) => Promise<void>
}) {
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listSessions>>>([])
  const [error, setError] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  const [exporting, setExporting] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [factors, setFactors] = useState<Awaited<ReturnType<typeof listMfaFactors>>['factors']>([])
  const [factorLabel, setFactorLabel] = useState('My authenticator')
  const [pendingTotp, setPendingTotp] = useState<Awaited<ReturnType<typeof startTotpEnrollment>> | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [mfaBusy, setMfaBusy] = useState(false)

  useEffect(() => {
    listSessions().then(setSessions).catch((cause) => setError(readableError(cause)))
    listMfaFactors().then((result) => setFactors(result.factors)).catch((cause) => setError(readableError(cause)))
  }, [])

  const exportPlaintext = async () => {
    setExporting(true)
    setError('')
    try {
      await onPlaintextExport(masterPassword)
      setMasterPassword('')
    } catch (cause) {
      setError(readableError(cause))
    } finally {
      setExporting(false)
    }
  }

  const refreshFactors = async () => setFactors((await listMfaFactors()).factors)
  const beginTotp = async () => {
    setMfaBusy(true); setError('')
    try { await onReauthenticate(masterPassword); setPendingTotp(await startTotpEnrollment(factorLabel)) }
    catch (cause) { setError(readableError(cause)) }
    finally { setMfaBusy(false) }
  }
  const confirmTotp = async () => {
    if (!pendingTotp) return
    setMfaBusy(true); setError('')
    try {
      const result = await confirmTotpEnrollment(pendingTotp.factorId, totpCode)
      setRecoveryCodes(result.recoveryCodes); setPendingTotp(null); setTotpCode(''); await refreshFactors()
    } catch (cause) { setError(readableError(cause)) }
    finally { setMfaBusy(false) }
  }
  const addPasskey = async () => {
    setMfaBusy(true); setError('')
    try {
      await onReauthenticate(masterPassword)
      const enrollment = await startPasskeyEnrollment(factorLabel)
      const response = await startRegistration({ optionsJSON: enrollment.options as unknown as PublicKeyCredentialCreationOptionsJSON })
      const result = await completePasskeyEnrollment(enrollment.enrollmentToken, response)
      setRecoveryCodes(result.recoveryCodes); await refreshFactors()
    } catch (cause) { setError(readableError(cause)) }
    finally { setMfaBusy(false) }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    setError('')
    try {
      await onDeleteAccount(masterPassword, confirmationEmail)
    } catch (cause) {
      setError(readableError(cause))
      setDeleting(false)
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal settings-modal">
    <div className="modal-heading"><div><p className="eyebrow">Security center</p><h2>Devices and sessions</h2></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
    <p className="modal-copy">Review authenticated devices and revoke anything you do not recognize.</p>
    {error && <p className="form-error">{error}</p>}
    <div className="session-list">{sessions.map((session) => <div className="session-row" key={session.id}>
      <span className="settings-icon"><Fingerprint size={18} /></span><div><b>{session.deviceName}</b><small>{session.current ? 'This device / ' : ''}Last active {new Date(session.lastSeenAt).toLocaleString()}</small></div>
      {session.current ? <span className="current-pill">Current</span> : <button className="danger-button small" onClick={async () => { await revokeSession(session.id); setSessions((current) => current.filter((value) => value.id !== session.id)) }}>Revoke</button>}
    </div>)}</div>
    <div className="encryption-card"><ShieldCheck size={21} /><div><b>Zero-knowledge session</b><p>Your vault key exists only in this browser's memory.</p></div></div>
    <div className="plaintext-export"><b>Multi-factor authentication</b><p>Enroll a TOTP authenticator or passkey. Your master password is required before security changes.</p>
      <input value={factorLabel} onChange={(event) => setFactorLabel(event.target.value)} placeholder="Factor name" maxLength={100} />
      <div className="session-list">{factors.map((factor) => <div className="session-row" key={factor.id}><span className="settings-icon"><Fingerprint size={18} /></span><div><b>{factor.label}</b><small>{factor.kind === 'webauthn' ? 'Passkey' : 'Authenticator app'} / added {new Date(factor.createdAt).toLocaleDateString()}</small></div><button className="danger-button small" onClick={async () => { setMfaBusy(true); try { await onReauthenticate(masterPassword); await disableMfaFactor(factor.id); await refreshFactors() } catch (cause) { setError(readableError(cause)) } finally { setMfaBusy(false) } }}>Remove</button></div>)}</div>
      {pendingTotp && <div className="encryption-card"><div><b>Enter this setup key in your authenticator</b><code>{pendingTotp.secret}</code><small>{pendingTotp.otpauthUri}</small><input value={totpCode} onChange={(event) => setTotpCode(event.target.value)} placeholder="6-digit code" autoComplete="one-time-code" /><button className="primary-button" disabled={mfaBusy || totpCode.length !== 6} onClick={() => void confirmTotp()}>Confirm authenticator</button></div></div>}
      {recoveryCodes.length > 0 && <div className="auth-success"><div><b>Save these single-use recovery codes now</b><code>{recoveryCodes.join('\n')}</code><p>They will not be shown again.</p></div></div>}
      <div className="modal-actions"><button className="primary-button" disabled={mfaBusy || masterPassword.length < 12 || !factorLabel} onClick={() => void beginTotp()}>Add authenticator</button><button className="primary-button" disabled={mfaBusy || masterPassword.length < 12 || !factorLabel} onClick={() => void addPasskey()}><Fingerprint size={15} /> Add passkey</button></div>
    </div>
    <div className="plaintext-export"><b>Plaintext export</b><p>Creates a readable JSON file on this device. Re-enter your master password to continue.</p><div className="input-wrap"><KeyRound size={17} /><input type="password" value={masterPassword} onChange={(event) => setMasterPassword(event.target.value)} placeholder="Master password" autoComplete="current-password" /></div><button className="danger-button full" disabled={exporting || masterPassword.length < 12} onClick={() => void exportPlaintext()}><Download size={15} /> {exporting ? 'Reauthenticating...' : 'Export readable vault'}</button></div>
    <div className="account-deletion"><b>Delete account</b><p>Type the account email and enter your master password. Access is revoked immediately and encrypted data is purged after seven days.</p><input type="email" value={confirmationEmail} onChange={(event) => setConfirmationEmail(event.target.value)} placeholder="Confirm account email" /><button className="danger-button full" disabled={deleting || masterPassword.length < 12 || !confirmationEmail} onClick={() => void deleteAccount()}>{deleting ? 'Scheduling deletion...' : 'Delete account permanently'}</button></div>
    <div className="modal-actions"><button className="danger-button" onClick={onLock}><LogOut size={16} /> Lock and sign out</button><button className="primary-button" onClick={onClose}>Done</button></div>
  </section></div>
}
