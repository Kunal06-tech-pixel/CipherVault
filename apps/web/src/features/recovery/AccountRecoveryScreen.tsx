import { useState, type FormEvent } from 'react'
import { Check, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, User } from 'lucide-react'
import { completeRecovery, login, recoveryChallenge, startRecovery } from '../../api'
import { vaultCrypto } from '../../crypto-client'
import { readableError } from '../../errors'
import { Logo } from '../../ui/Logo'

export function AccountRecoveryScreen({ onRecovered }: { onRecovered: (email: string) => void }) {
  const token = new URLSearchParams(location.search).get('token') ?? ''
  const [email, setEmail] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaMethods, setMfaMethods] = useState<Array<'totp' | 'webauthn'>>([])
  const [mfaCode, setMfaCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!token) {
        await startRecovery(email)
        setMessage('If the account exists, a recovery link was sent. Your offline recovery key will also be required.')
      } else {
        if (masterPassword.length < 12 || masterPassword !== confirmPassword) {
          throw new Error('The new master passwords do not match or are too short.')
        }
        const challenge = await recoveryChallenge(token)
        setMfaRequired(challenge.mfaRequired)
        setMfaMethods(challenge.mfaMethods)
        if (challenge.mfaRequired && !mfaCode) throw new Error('An authenticator or recovery code is required for this MFA-protected account.')
        const recovered = await vaultCrypto.recover(recoveryKey, challenge.recoveryWrappedVaultKey, masterPassword)
        await completeRecovery({ token, authKey: recovered.authKey, wrappedVaultKey: recovered.wrappedVaultKey, ...(mfaCode ? { mfaCode: mfaCode.trim().toUpperCase() } : {}) })
        const session = await login({ email: challenge.email, authKey: recovered.authKey, deviceName: navigator.userAgent.slice(0, 100) })
        if ('mfaRequired' in session) throw new Error('Recovery succeeded. Sign in again with your MFA factor.')
        history.replaceState({}, '', '/')
        onRecovered(challenge.email)
      }
    } catch (cause) {
      setError(readableError(cause))
      await vaultCrypto.lock()
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-shell production-auth">
    <div className="auth-brand"><Logo light /></div>
    <section className="auth-card production-auth-card">
      <div className="auth-icon"><RefreshCw size={24} /></div>
      <p className="eyebrow">Zero-knowledge recovery</p>
      <h1>{token ? 'Recover your encrypted vault' : 'Request account recovery'}</h1>
      <p className="auth-copy">{token ? 'The email link and offline recovery key are both required. Your new password will rewrap the existing vault key.' : 'We will send a short-lived link. It cannot bypass your offline recovery key.'}</p>
      <form onSubmit={submit}>
        {!token ? <><label className="field-label">Account email</label><div className="input-wrap"><User size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus /></div></> : <>
          <label className="field-label">Recovery key</label><div className="input-wrap"><ShieldCheck size={17} /><input value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value)} required autoFocus /></div>
          <label className="field-label">New master password</label><div className="input-wrap"><KeyRound size={17} /><input type="password" value={masterPassword} onChange={(event) => setMasterPassword(event.target.value)} required /></div>
          <label className="field-label">Confirm new master password</label><div className="input-wrap"><LockKeyhole size={17} /><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
          {mfaRequired && <><label className="field-label">MFA code ({mfaMethods.includes('totp') ? 'authenticator or recovery code' : 'recovery code'})</label><div className="input-wrap"><ShieldCheck size={17} /><input value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="123456 or ABCD-EFGH" autoComplete="one-time-code" required /></div></>}
        </>}
        {message && <p className="auth-success"><Check size={15} />{message}</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full" disabled={busy}>{busy ? 'Verifying recovery material...' : token ? 'Recover and revoke old sessions' : 'Send recovery link'}</button>
      </form>
      <a className="forgot-link" href="/">Return to sign in</a>
    </section>
  </main>
}
