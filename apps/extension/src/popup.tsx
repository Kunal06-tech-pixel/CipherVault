import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Check, Copy, KeyRound, LockKeyhole, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { brand } from '@keywall/brand'
import type { VaultItem } from '@keywall/contracts'
import type { ExtensionStatus } from './messages'
import { generatePassword } from './generator'
import './popup.css'

const WEB_URL = 'http://localhost:8080'

function App() {
  const [status, setStatus] = useState<ExtensionStatus>({ unlocked: false, itemCount: 0, lastActivity: 0 })
  const [items, setItems] = useState<VaultItem[]>([])
  const [query, setQuery] = useState('')
  const [generated, setGenerated] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: 'status' }).then(setStatus)
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (tab?.url) setItems(await chrome.runtime.sendMessage({ type: 'items-for-url', url: tab.url }) as VaultItem[])
    })
  }, [])

  const filtered = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [items, query])
  const fill = async (item: VaultItem) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
    await chrome.tabs.sendMessage(tab.id, { type: 'fill', item })
    window.close()
  }

  if (!status.unlocked) return <main className="popup locked"><div className="brand"><span><ShieldCheck size={19} /></span><b>{brand.productName}</b></div><div className="lock-art"><LockKeyhole size={27} /></div><h1>Extension locked</h1><p>Unlock the web vault, then pair this browser to enable private autofill.</p><button onClick={() => chrome.tabs.create({ url: `${WEB_URL}/app?extension=pair` })}><KeyRound size={16} /> Open {brand.productName}</button><small>Keys are cleared after 5 minutes of inactivity.</small></main>

  return <main className="popup"><div className="brand"><span><ShieldCheck size={19} /></span><b>{brand.productName}</b><i>Unlocked</i></div><div className="search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this site" /></div>
    <section className="matches"><label>{filtered.length} matching {filtered.length === 1 ? 'login' : 'logins'}</label>{filtered.map((item) => <button className="match" key={item.id} onClick={() => void fill(item)}><span><KeyRound size={17} /></span><div><b>{item.name}</b><small>{String(item.fields.username ?? '')}</small></div><Check size={15} /></button>)}</section>
    <section className="generator"><div><Sparkles size={15} /><b>Quick generator</b></div>{generated ? <code>{generated}</code> : <p>Create a strong password without leaving this page.</p>}<button onClick={async () => { if (!generated) { setGenerated(generatePassword()); return } await navigator.clipboard.writeText(generated); setCopied(true) }}>{copied ? <Check size={14} /> : <Copy size={14} />}{!generated ? 'Generate' : copied ? 'Copied' : 'Copy'}</button></section>
    <footer><ShieldCheck size={13} /> Zero-knowledge autofill <button onClick={() => { void chrome.runtime.sendMessage({ type: 'lock' }); setStatus((value) => ({ ...value, unlocked: false })) }}>Lock</button></footer>
  </main>
}

createRoot(document.getElementById('root')!).render(<App />)
