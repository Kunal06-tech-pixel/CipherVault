import { useEffect, useState } from 'react'
import { Clipboard, RefreshCw } from 'lucide-react'
import { generateTotp } from './totp'

export function TotpCode({ secret }: { secret: string }) {
  const [code, setCode] = useState('------')
  const [remaining, setRemaining] = useState(30)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const refresh = () => {
      generateTotp(secret).then((result) => {
        if (!active) return
        setCode(result.code)
        setRemaining(result.remainingSeconds)
        setError('')
      }).catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not generate a TOTP code.')
      })
    }
    refresh()
    const timer = window.setInterval(refresh, 1000)
    return () => { active = false; window.clearInterval(timer) }
  }, [secret])

  if (error) return <p className="form-error">{error}</p>
  return <div className="totp-code"><RefreshCw size={15} /><b>{code.replace(/(\d{3})(\d{3})/u, '$1 $2')}</b><small>{remaining}s</small><button className="icon-button subtle" onClick={() => navigator.clipboard.writeText(code)} aria-label="Copy current TOTP code"><Clipboard size={15} /></button></div>
}
