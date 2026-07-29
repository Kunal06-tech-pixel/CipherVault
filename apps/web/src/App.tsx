import { useCallback, useEffect, useState } from 'react'
import { logout } from './api'
import { vaultCrypto } from './crypto-client'
import { AuthScreen } from './features/auth/AuthScreen'
import { LandingPage } from './features/landing/LandingPage'
import { AccountRecoveryScreen } from './features/recovery/AccountRecoveryScreen'
import { RecoveryDialog } from './features/recovery/RecoveryDialog'
import { VaultScreen } from './features/vault/VaultScreen'

export default function App() {
  const [session, setSession] = useState<{ email: string } | null>(null)
  const [recoveryKey, setRecoveryKey] = useState('')

  const lock = useCallback(async () => {
    await vaultCrypto.lock()
    await logout().catch(() => undefined)
    setSession(null)
  }, [])

  const unlocked = (email: string, key?: string) => {
    setSession({ email })
    if (key) setRecoveryKey(key)
    if (!location.pathname.endsWith('/app')) history.replaceState({}, '', '/app')
  }

  useEffect(() => {
    const lockOnPageHide = () => { void vaultCrypto.lock() }
    window.addEventListener('pagehide', lockOnPageHide)
    return () => window.removeEventListener('pagehide', lockOnPageHide)
  }, [])
  const path = location.pathname
  const initialMode = new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login'

  if (!session && path.endsWith('/recover')) {
    return <AccountRecoveryScreen onRecovered={(email) => {
      setSession({ email })
      history.replaceState({}, '', '/app')
    }} />
  }
  if (!session && path.endsWith('/verify-email')) return <AuthScreen initialMode="login" onUnlock={unlocked} />
  if (!session && path.endsWith('/app')) return <AuthScreen initialMode={initialMode} onUnlock={unlocked} />
  if (!session) return <LandingPage />
  if (recoveryKey) return <RecoveryDialog recoveryKey={recoveryKey} onDone={() => setRecoveryKey('')} />
  return <VaultScreen email={session.email} onLock={() => void lock()} />
}
