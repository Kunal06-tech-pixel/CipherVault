import { useState } from 'react'
import { Check, Download, ShieldCheck } from 'lucide-react'

export function RecoveryDialog({ recoveryKey, onDone }: { recoveryKey: string; onDone: () => void }) {
  const [confirmed, setConfirmed] = useState(false)
  const download = () => {
    const blob = new Blob([
      `Keywall Recovery Kit\n\nRecovery key: ${recoveryKey}\n\nKeep this file offline. Keywall cannot recover this key for you.\n`,
    ], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'keywall-recovery-kit.txt'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return <div className="modal-backdrop"><section className="modal recovery-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
    <div className="recovery-shield"><ShieldCheck size={28} /></div>
    <p className="eyebrow">One-time recovery kit</p><h2 id="recovery-title">Save this key offline</h2>
    <p className="modal-copy">It is the only way to recover your encrypted vault if you forget the master password. We cannot regenerate it.</p>
    <code className="recovery-code">{recoveryKey}</code>
    <button className="secondary-button full recovery-download" onClick={download}><Download size={16} /> Download recovery kit</button>
    <label className="favorite-toggle recovery-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span className="custom-check"><Check size={13} /></span>I saved the recovery key somewhere safe.</label>
    <button className="primary-button full" disabled={!confirmed} onClick={onDone}>Continue to my vault</button>
  </section></div>
}
