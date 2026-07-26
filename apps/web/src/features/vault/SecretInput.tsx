import { Clipboard, Eye, EyeOff, X } from 'lucide-react'
import { useState } from 'react'

export function SecretInput({ value, onChange, placeholder, required, onCopy }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string | undefined
  required?: boolean | undefined
  onCopy?: (() => void) | undefined
}) {
  const [revealed, setRevealed] = useState(false)
  return <div className="password-field">
    <input
      type={revealed ? 'text' : 'password'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
      autoComplete="off"
    />
    {value && <button type="button" className="icon-button subtle" onClick={() => onChange('')} aria-label="Clear value"><X size={15} /></button>}
    {onCopy && <button type="button" className="icon-button subtle" onClick={onCopy} aria-label="Copy value"><Clipboard size={15} /></button>}
    <button type="button" className="icon-button subtle" onClick={() => setRevealed((current) => !current)} aria-label={revealed ? 'Hide value' : 'Show value'}>
      {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  </div>
}
