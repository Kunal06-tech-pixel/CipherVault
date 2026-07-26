import { ShieldCheck } from 'lucide-react'

export function Logo({ light = false }: { light?: boolean }) {
  return <div className={`logo ${light ? 'logo-light' : ''}`}>
    <span className="logo-mark"><ShieldCheck size={21} /></span>
    <span>Cipher<span>Vault</span></span>
  </div>
}
