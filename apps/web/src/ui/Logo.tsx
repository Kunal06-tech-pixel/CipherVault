import { ShieldCheck } from 'lucide-react'
import { brand } from '@keywall/brand'

export function Logo({ light = false }: { light?: boolean }) {
  return <div className={`logo ${light ? 'logo-light' : ''}`}>
    <span className="logo-mark"><ShieldCheck size={21} /></span>
    <span>{brand.productName}</span>
  </div>
}
