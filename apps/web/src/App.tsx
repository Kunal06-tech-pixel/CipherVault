import { useCallback, useEffect, useState } from 'react'
import { logout } from './api'
import { vaultCrypto } from './crypto-client'
import { AuthScreen } from './features/auth/AuthScreen'
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
  }

  useEffect(() => () => vaultCrypto.destroy(), [])
  if (!session && location.pathname.endsWith('/recover')) {
    return <AccountRecoveryScreen onRecovered={(email) => setSession({ email })} />
  }
  if (!session) return <AuthScreen onUnlock={unlocked} />
  if (recoveryKey) return <RecoveryDialog recoveryKey={recoveryKey} onDone={() => setRecoveryKey('')} />
  return <VaultScreen email={session.email} onLock={() => void lock()} />
}
