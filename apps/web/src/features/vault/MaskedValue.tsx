import { Clipboard, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'

export function maskValue(value: string, kind: 'generic' | 'card' | 'pin' = 'generic'): string {
  if (!value) return '-'
  if (kind === 'card') {
    const digits = value.replace(/\D/gu, '')
    return `**** **** **** ${digits.slice(-4) || '****'}`
  }
  if (kind === 'pin') return '*'.repeat(Math.min(Math.max(value.length, 3), 8))
  return '************'
}

export function MaskedValue({ value, sensitive, highRisk, maskKind, onRequireReauth, onCopy }: {
  value: string
  sensitive: boolean
  highRisk: boolean
  maskKind?: 'generic' | 'card' | 'pin'
  onRequireReauth: (reason: string, action: () => void) => void
  onCopy: (value: string) => void
}) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    if (!revealed) return undefined
    const timeout = window.setTimeout(() => setRevealed(false), 30_000)
    return () => window.clearTimeout(timeout)
  }, [revealed])
  const reveal = () => {
    const action = () => setRevealed(true)
    if (highRisk) onRequireReauth('Reveal this highly sensitive vault value.', action)
    else action()
  }
  const copy = () => {
    const action = () => onCopy(value)
    if (highRisk) onRequireReauth('Copy this highly sensitive vault value.', action)
    else action()
  }
  return <div>
    <b className={sensitive ? 'mono secret-value' : ''}>{sensitive && !revealed ? maskValue(value, maskKind) : value || '-'}</b>
    {sensitive && <button className="icon-button subtle" onClick={revealed ? () => setRevealed(false) : reveal} aria-label={revealed ? 'Hide value' : 'Reveal value'}>{revealed ? <EyeOff size={14} /> : <Eye size={14} />}</button>}
    <button className="icon-button subtle" onClick={copy} aria-label="Copy value"><Clipboard size={14} /></button>
  </div>
}
