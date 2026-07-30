import { useEffect, useState, type FormEvent } from 'react'
import { Check, Eye, EyeOff, KeyRound, ShieldCheck, User } from 'lucide-react'
import { brand } from '@keywall/brand'
import type { SyncMutation } from '@keywall/contracts'
import { ApiError, login, prelogin, pushMutations, registerAccount, verifyEmail, type MfaLoginChallenge } from '../../api'
import { vaultCrypto } from '../../crypto-client'
import { readableError } from '../../errors'
import { hasLegacyVault, removeLegacyVault, unlockLegacyVault } from '../../legacy'
import { Logo } from '../../ui/Logo'
import { RecoveryDialog } from '../recovery/RecoveryDialog'
import { MfaChallenge } from './MfaChallenge'
import { LockStatus3D } from '../../components/3d/LockStatus3D'

type AuthMode = 'login' | 'register'

export function AuthScreen({ initialMode = 'login', onUnlock }: { initialMode?: AuthMode; onUnlock: (email: string, recoveryKey?: string) => void }) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [verification, setVerification] = useState('')
  const [registration, setRegistration] = useState<Awaited<ReturnType<typeof vaultCrypto.register>> | null>(null)
  const [mfaChallenge, setMfaChallenge] = useState<MfaLoginChallenge | null>(null)

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('token')
    if (!token || !location.pathname.endsWith('/verify-email')) return
    setBusy(true)
    verifyEmail(token).then(() => {
      setVerification('Email verified. You can now unlock your vault.')
      history.replaceState({}, '', '/app')
    }).catch((cause) => setError(readableError(cause))).finally(() => setBusy(false))
  }, [])

  const migrateLegacy = async () => {
    if (!hasLegacyVault() || !window.confirm('A legacy local vault was found. Migrate it into your synchronized encrypted account now?')) return
    const legacyItems = await unlockLegacyVault(masterPassword)
    const mutations: SyncMutation[] = []
    for (const item of legacyItems) {
      const encrypted = await vaultCrypto.encrypt(item, 0)
      mutations.push({
        itemId: item.id,
        baseRevision: 0,
        encryptedPayload: {
          cryptoVersion: encrypted.cryptoVersion,
          itemVersion: encrypted.itemVersion,
          nonce: encrypted.nonce,
          ciphertext: encrypted.ciphertext,
        },
      })
    }
    for (let index = 0; index < mutations.length; index += 100) {
      const result = await pushMutations(mutations.slice(index, index + 100))
      if (result.conflicts.length) throw new Error('Legacy migration found a synchronization conflict and was not finalized.')
    }
    removeLegacyVault()
  }

  const finishRegistration = async () => {
    if (!registration) return
    setBusy(true)
    setError('')
    try {
      const session = await login({ email, authKey: registration.authKey, deviceName: navigator.userAgent.slice(0, 100) })
      if ('mfaRequired' in session) { setMfaChallenge(session); return }
      await migrateLegacy()
      onUnlock(email)
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'email_not_verified') {
        setVerification('Recovery key saved. Check your email to verify the account, then sign in.')
        setMode('login')
      } else {
        setError(readableError(cause))
      }
      await vaultCrypto.lock()
    } finally {
      setRegistration(null)
      setBusy(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (masterPassword.length < 12 || (mode === 'register' && masterPassword !== confirmPassword)) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'register') {
        const material = await vaultCrypto.register(masterPassword)
        await registerAccount({
          email,
          authKey: material.authKey,
          wrappedVaultKey: material.wrappedVaultKey,
          recoveryWrappedVaultKey: material.recoveryWrappedVaultKey,
        })
        setRegistration(material)
      } else {
        const challenge = await prelogin(email)
        const derived = await vaultCrypto.deriveAuth(masterPassword, challenge.salt, challenge.kdf)
        const session = await login({ email, authKey: derived.authKey, deviceName: navigator.userAgent.slice(0, 100) })
        if ('mfaRequired' in session) { setMfaChallenge(session); return }
        await vaultCrypto.unlock(session.wrappedVaultKey)
        await migrateLegacy()
        onUnlock(session.email)
      }
    } catch (cause) {
      setError(readableError(cause))
      await vaultCrypto.lock()
    } finally {
      setBusy(false)
    }
  }

  if (mfaChallenge) return <main className="auth-shell production-auth"><div className="auth-brand"><Logo light /></div><MfaChallenge challenge={mfaChallenge} onCancel={() => { setMfaChallenge(null); void vaultCrypto.lock() }} onComplete={async (session) => { await vaultCrypto.unlock(session.wrappedVaultKey); await migrateLegacy(); onUnlock(session.email) }} /></main>

  return <main className="auth-shell production-auth">
    <div className="auth-brand"><Logo light /></div>
    <section className="auth-card production-auth-card">
      <div className="auth-icon"><LockStatus3D isLocked={true} size={54} /></div>
      <p className="eyebrow">Zero-knowledge security</p>
      <h1>{mode === 'register' ? 'Create your encrypted vault' : `Unlock ${brand.productName}`}</h1>
      <p className="auth-copy">{mode === 'register' ? 'Your master password creates keys on this device. We never receive it or your vault key.' : 'Authenticate and decrypt your synchronized vault on this device.'}</p>
      <div className="auth-tabs" role="tablist">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Sign in</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>Create account</button>
      </div>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="email">Email address</label>
        <div className="input-wrap"><User size={18} /><input id="email" name="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="username" required /></div>
        <label className="field-label" htmlFor="master">Master password</label>
        <div className="input-wrap"><KeyRound size={18} /><input id="master" type={showPassword ? 'text' : 'password'} value={masterPassword} onChange={(event) => setMasterPassword(event.target.value)} placeholder="At least 12 characters" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required /><button type="button" className="icon-button subtle" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        {mode === 'register' && <><label className="field-label" htmlFor="confirm">Confirm master password</label><div className="input-wrap"><ShieldCheck size={18} /><input id="confirm" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your master password" autoComplete="new-password" required />{confirmPassword && confirmPassword === masterPassword && <Check className="input-ok" size={17} />}</div></>}
        {verification && <p className="auth-success"><Check size={15} />{verification}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button full" disabled={busy || !email || masterPassword.length < 12 || (mode === 'register' && masterPassword !== confirmPassword)}>{busy ? 'Securing your session...' : mode === 'register' ? 'Create zero-knowledge account' : 'Unlock vault'}</button>
      </form>
      {mode === 'login' && <a className="forgot-link" href="/recover">Forgot your master password?</a>}
      <div className="auth-note"><ShieldCheck size={16} /> Argon2id / AES-256-GCM / Keys stay on your device</div>
    </section>
    {registration && <RecoveryDialog recoveryKey={registration.recoveryKey} onDone={() => void finishRegistration()} />}
  </main>
}
