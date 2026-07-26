import { useState } from 'react'
import { KeyRound, ShieldCheck, X } from 'lucide-react'
import { readableError } from '../../errors'

export function ReauthenticationDialog({ reason, onCancel, onConfirm }: {
  reason: string
  onCancel: () => void
  onConfirm: (masterPassword: string) => Promise<void>
}) {
  const [masterPassword, setMasterPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await onConfirm(masterPassword)
      setMasterPassword('')
    } catch (cause) {
      setError(readableError(cause))
    } finally {
      setBusy(false)
    }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <section className="modal confirm-dialog reauth-dialog" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
      <div className="modal-heading"><div><p className="eyebrow">Recent reauthentication</p><h2 id="reauth-title">Confirm master password</h2></div><button className="icon-button" onClick={onCancel} aria-label="Close"><X size={18} /></button></div>
      <p className="modal-copy">{reason}</p>
      <div className="input-wrap"><KeyRound size={17} /><input type="password" value={masterPassword} onChange={(event) => setMasterPassword(event.target.value)} placeholder="Master password" autoComplete="current-password" autoFocus /></div>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions"><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={busy || masterPassword.length < 12} onClick={() => void submit()}><ShieldCheck size={15} /> {busy ? 'Checking...' : 'Confirm'}</button></div>
    </section>
  </div>
}
