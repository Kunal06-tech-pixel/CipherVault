import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Clipboard,
  CreditCard,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  Folder,
  Globe2,
  Heart,
  KeyRound,
  LayoutGrid,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react'
import {
  createEncryptedVault,
  decryptVault,
  encryptVault,
  loadEnvelope,
  saveEnvelope,
  STORAGE_KEY,
} from './lib/crypto'
import { generatePassword, hostname, passwordScore } from './lib/password'

const categories = [
  { value: 'Personal', icon: User, color: '#5c78e6' },
  { value: 'Work', icon: BriefcaseBusiness, color: '#8b68d9' },
  { value: 'Finance', icon: CreditCard, color: '#16a47a' },
  { value: 'Other', icon: Folder, color: '#da8b32' },
]

const emptyEntry = {
  title: '',
  username: '',
  password: '',
  website: '',
  category: 'Personal',
  notes: '',
  favorite: false,
}

function Logo({ light = false }) {
  return (
    <div className={`logo ${light ? 'logo-light' : ''}`}>
      <span className="logo-mark"><ShieldCheck size={21} strokeWidth={2.2} /></span>
      <span>Cipher<span>Vault</span></span>
    </div>
  )
}

function Toast({ message }) {
  if (!message) return null
  return <div className="toast"><span><Check size={15} /></span>{message}</div>
}

function SetupScreen({ onComplete, busy, error }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const score = passwordScore(password)
  const valid = password.length >= 12 && password === confirm

  const submit = (event) => {
    event.preventDefault()
    if (valid) onComplete(password)
  }

  return (
    <main className="auth-shell">
      <div className="auth-brand"><Logo light /></div>
      <section className="auth-card setup-card">
        <div className="auth-icon"><KeyRound size={25} /></div>
        <p className="eyebrow">Private by design</p>
        <h1>Create your secure vault</h1>
        <p className="auth-copy">Choose a master password. It encrypts your vault on this device and is never stored or transmitted.</p>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="new-password">Master password</label>
          <div className="input-wrap">
            <LockKeyhole size={18} />
            <input
              id="new-password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 12 characters"
              autoComplete="new-password"
              autoFocus
            />
            <button type="button" className="icon-button subtle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="strength-row">
            <div className="strength-bars">
              {[1, 2, 3, 4].map((bar) => <i key={bar} className={score.score >= bar ? 'active' : ''} style={{ '--strength': score.color }} />)}
            </div>
            <span style={{ color: score.color }}>{score.label}</span>
          </div>
          <label className="field-label" htmlFor="confirm-password">Confirm master password</label>
          <div className="input-wrap">
            <ShieldCheck size={18} />
            <input
              id="confirm-password"
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repeat your master password"
              autoComplete="new-password"
            />
            {confirm && password === confirm && <Check className="input-ok" size={18} />}
          </div>
          {confirm && password !== confirm && <p className="field-error">Passwords do not match.</p>}
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button full" disabled={!valid || busy}>
            {busy ? 'Encrypting your vault…' : 'Create encrypted vault'}
          </button>
        </form>
        <div className="auth-note"><ShieldCheck size={16} /> Your data is protected with AES-256-GCM encryption.</div>
      </section>
      <p className="auth-footer">Zero-knowledge encryption · Stored locally · No tracking</p>
    </main>
  )
}

function UnlockScreen({ onUnlock, busy, error }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const submit = (event) => {
    event.preventDefault()
    if (password) onUnlock(password)
  }

  return (
    <main className="auth-shell">
      <div className="auth-brand"><Logo light /></div>
      <section className="auth-card unlock-card">
        <div className="auth-icon"><LockKeyhole size={25} /></div>
        <p className="eyebrow">Welcome back</p>
        <h1>Unlock your vault</h1>
        <p className="auth-copy">Enter your master password to decrypt your passwords on this device.</p>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="master-password">Master password</label>
          <div className="input-wrap">
            <KeyRound size={18} />
            <input
              id="master-password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your master password"
              autoComplete="current-password"
              autoFocus
            />
            <button type="button" className="icon-button subtle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button full" disabled={!password || busy}>
            {busy ? 'Unlocking…' : <><LockKeyhole size={17} /> Unlock vault</>}
          </button>
        </form>
        <div className="auth-note"><ShieldCheck size={16} /> Your master password never leaves this device.</div>
      </section>
      <p className="auth-footer">Your vault locks automatically after inactivity.</p>
    </main>
  )
}

function PasswordGenerator({ onClose, onUse }) {
  const [options, setOptions] = useState({ length: 20, lowercase: true, uppercase: true, numbers: true, symbols: true })
  const [password, setPassword] = useState(() => generatePassword())
  const score = passwordScore(password)

  const regenerate = useCallback((next = options) => setPassword(generatePassword(next)), [options])
  const update = (key, value) => {
    const next = { ...options, [key]: value }
    if (!next.lowercase && !next.uppercase && !next.numbers && !next.symbols) return
    setOptions(next)
    regenerate(next)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal generator-modal" role="dialog" aria-modal="true" aria-labelledby="generator-title">
        <div className="modal-heading">
          <div><p className="eyebrow">Security tool</p><h2 id="generator-title">Password generator</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <p className="modal-copy">Create a unique, cryptographically random password.</p>
        <div className="generated-password">
          <span>{password}</span>
          <button className="icon-button" onClick={() => regenerate()} title="Generate another"><RefreshCw size={18} /></button>
        </div>
        <div className="generator-strength">
          <span>Strength</span>
          <div className="meter"><i style={{ width: `${score.score * 25}%`, background: score.color }} /></div>
          <b style={{ color: score.color }}>{score.label}</b>
        </div>
        <div className="range-header"><label htmlFor="password-length">Password length</label><output>{options.length}</output></div>
        <input id="password-length" className="range" type="range" min="12" max="40" value={options.length} onChange={(event) => update('length', Number(event.target.value))} />
        <div className="generator-options">
          {[
            ['uppercase', 'Uppercase', 'A–Z'],
            ['lowercase', 'Lowercase', 'a–z'],
            ['numbers', 'Numbers', '0–9'],
            ['symbols', 'Symbols', '!@#'],
          ].map(([key, label, hint]) => (
            <label key={key} className="check-option">
              <input type="checkbox" checked={options[key]} onChange={(event) => update(key, event.target.checked)} />
              <span className="custom-check"><Check size={13} /></span>
              <span>{label}</span><small>{hint}</small>
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={() => navigator.clipboard.writeText(password)}><Clipboard size={16} /> Copy</button>
          <button className="primary-button" onClick={() => { onUse?.(password); onClose() }}><Zap size={16} /> Use password</button>
        </div>
      </section>
    </div>
  )
}

function EntryModal({ entry, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({ ...emptyEntry, ...entry }))
  const [showPassword, setShowPassword] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const score = passwordScore(form.password)
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const submit = (event) => {
    event.preventDefault()
    if (form.title.trim() && form.password) onSave({ ...form, title: form.title.trim(), username: form.username.trim(), website: form.website.trim() })
  }

  return (
    <>
      <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="modal entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title">
          <div className="modal-heading">
            <div><p className="eyebrow">{entry?.id ? 'Edit credential' : 'New credential'}</p><h2 id="entry-title">{entry?.id ? entry.title : 'Add a password'}</h2></div>
            <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
          </div>
          <form onSubmit={submit}>
            <div className="two-columns">
              <label><span className="field-label">Name</span><input value={form.title} onChange={(event) => set('title', event.target.value)} placeholder="e.g. Linear" autoFocus required /></label>
              <label><span className="field-label">Category</span><div className="select-wrap"><select value={form.category} onChange={(event) => set('category', event.target.value)}>{categories.map((category) => <option key={category.value}>{category.value}</option>)}</select><ChevronDown size={16} /></div></label>
            </div>
            <label><span className="field-label">Username or email</span><input value={form.username} onChange={(event) => set('username', event.target.value)} placeholder="name@example.com" autoComplete="off" /></label>
            <label><span className="field-label">Password</span>
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => set('password', event.target.value)} placeholder="Enter or generate a password" autoComplete="new-password" required />
                <button type="button" className="icon-button subtle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                <button type="button" className="generate-mini" onClick={() => setShowGenerator(true)}><Sparkles size={15} /> Generate</button>
              </div>
            </label>
            {form.password && <div className="inline-strength"><div className="meter"><i style={{ width: `${score.score * 25}%`, background: score.color }} /></div><span style={{ color: score.color }}>{score.label}</span></div>}
            <label><span className="field-label">Website</span><input value={form.website} onChange={(event) => set('website', event.target.value)} placeholder="https://example.com" inputMode="url" /></label>
            <label><span className="field-label">Secure notes</span><textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Optional recovery details or notes" rows="3" /></label>
            <label className="favorite-toggle"><input type="checkbox" checked={form.favorite} onChange={(event) => set('favorite', event.target.checked)} /><span className="custom-check"><Check size={13} /></span>Add to favorites</label>
            <div className="modal-actions split-actions">
              <div>{entry?.id && <button type="button" className="danger-button" onClick={() => onDelete(entry.id)}><Trash2 size={16} /> Delete</button>}</div>
              <div><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button"><ShieldCheck size={16} /> Save encrypted</button></div>
            </div>
          </form>
        </section>
      </div>
      {showGenerator && <PasswordGenerator onClose={() => setShowGenerator(false)} onUse={(password) => set('password', password)} />}
    </>
  )
}

function SettingsModal({ timeout, setTimeoutMinutes, envelope, onImport, onClose }) {
  const fileRef = useRef(null)
  const exportVault = () => {
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ciphervault-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-heading"><div><p className="eyebrow">Vault controls</p><h2 id="settings-title">Security settings</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
        <div className="settings-row">
          <div className="settings-icon"><LockKeyhole size={19} /></div>
          <div><b>Automatic lock</b><p>Lock the vault after a period of inactivity.</p></div>
          <div className="select-wrap compact"><select value={timeout} onChange={(event) => setTimeoutMinutes(Number(event.target.value))}><option value="1">1 minute</option><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select><ChevronDown size={14} /></div>
        </div>
        <div className="settings-row">
          <div className="settings-icon"><FileDown size={19} /></div>
          <div><b>Encrypted backup</b><p>Download a portable copy. Your master password is required to open it.</p></div>
          <button className="secondary-button small" onClick={exportVault}>Export</button>
        </div>
        <div className="settings-row">
          <div className="settings-icon"><FileUp size={19} /></div>
          <div><b>Restore backup</b><p>Replace this local vault with a CipherVault backup.</p></div>
          <button className="secondary-button small" onClick={() => fileRef.current?.click()}>Import</button>
          <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file) }} />
        </div>
        <div className="encryption-card"><ShieldCheck size={22} /><div><b>End-to-end encrypted on this device</b><p>AES-256-GCM · PBKDF2-SHA-256 · 310,000 iterations</p></div></div>
        <div className="modal-actions"><button className="primary-button" onClick={onClose}>Done</button></div>
      </section>
    </div>
  )
}

function EntryRow({ entry, selected, onSelect, onCopy, onToggleFavorite }) {
  const category = categories.find((item) => item.value === entry.category) || categories[3]
  const CategoryIcon = category.icon
  return (
    <button className={`entry-row ${selected ? 'selected' : ''}`} onClick={() => onSelect(entry)}>
      <span className="site-avatar" style={{ '--avatar': category.color }}><CategoryIcon size={19} /></span>
      <span className="entry-primary"><b>{entry.title}</b><small>{entry.username || 'No username'}</small></span>
      <span className="entry-website">{hostname(entry.website) || '—'}</span>
      <span className="entry-category"><i style={{ background: category.color }} />{entry.category}</span>
      <span className="entry-password"><span>••••••••••••</span><span className="icon-button" role="button" tabIndex="0" title="Copy password" onClick={(event) => { event.stopPropagation(); onCopy(entry.password) }}><Clipboard size={16} /></span></span>
      <span className={`row-star ${entry.favorite ? 'active' : ''}`} role="button" tabIndex="0" onClick={(event) => { event.stopPropagation(); onToggleFavorite(entry.id) }}><Star size={17} fill={entry.favorite ? 'currentColor' : 'none'} /></span>
      <MoreHorizontal className="row-more" size={18} />
    </button>
  )
}

function DetailPanel({ entry, onClose, onEdit, onCopy, onToggleFavorite }) {
  const [revealed, setRevealed] = useState(false)
  if (!entry) return null
  const category = categories.find((item) => item.value === entry.category) || categories[3]
  const CategoryIcon = category.icon
  return (
    <aside className="detail-panel">
      <div className="detail-top"><button className="icon-button" onClick={onClose}><X size={19} /></button><div><button className={`icon-button ${entry.favorite ? 'starred' : ''}`} onClick={() => onToggleFavorite(entry.id)}><Star size={18} fill={entry.favorite ? 'currentColor' : 'none'} /></button><button className="icon-button" onClick={() => onEdit(entry)}><Pencil size={17} /></button></div></div>
      <div className="detail-identity"><span className="detail-avatar" style={{ '--avatar': category.color }}><CategoryIcon size={28} /></span><h2>{entry.title}</h2><p>{hostname(entry.website) || entry.category}</p></div>
      <div className="detail-fields">
        <div className="detail-field"><span>Username</span><div><b>{entry.username || '—'}</b>{entry.username && <button className="icon-button subtle" onClick={() => onCopy(entry.username, 'Username')}><Clipboard size={15} /></button>}</div></div>
        <div className="detail-field"><span>Password</span><div><b className="mono">{revealed ? entry.password : '••••••••••••'}</b><button className="icon-button subtle" onClick={() => setRevealed(!revealed)}>{revealed ? <EyeOff size={16} /> : <Eye size={16} />}</button><button className="icon-button subtle" onClick={() => onCopy(entry.password)}><Clipboard size={15} /></button></div></div>
        <div className="detail-field"><span>Website</span><div><b>{hostname(entry.website) || '—'}</b>{entry.website && <a className="icon-button subtle" href={entry.website.startsWith('http') ? entry.website : `https://${entry.website}`} target="_blank" rel="noreferrer"><Globe2 size={15} /></a>}</div></div>
        <div className="detail-field"><span>Category</span><div><b><i className="category-dot" style={{ background: category.color }} />{entry.category}</b></div></div>
        {entry.notes && <div className="detail-field notes"><span>Secure notes</span><p>{entry.notes}</p></div>}
      </div>
      <div className="detail-footer"><ShieldCheck size={15} /> Updated {new Date(entry.updatedAt).toLocaleDateString()}</div>
    </aside>
  )
}

function VaultApp({ initialVault, initialKey, initialEnvelope, onLock, onEnvelopeChange }) {
  const [entries, setEntries] = useState(initialVault.entries || [])
  const [envelope, setEnvelope] = useState(initialEnvelope)
  const [activeFilter, setActiveFilter] = useState('All items')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [showGenerator, setShowGenerator] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [timeoutMinutes, setTimeoutMinutesState] = useState(() => Number(localStorage.getItem('ciphervault.timeout')) || 5)
  const keyRef = useRef(initialKey)
  const vaultRef = useRef(initialVault)
  const lockTimer = useRef(null)

  const flash = useCallback((message) => {
    setToast(message)
    window.clearTimeout(flash.timer)
    flash.timer = window.setTimeout(() => setToast(''), 2400)
  }, [])

  const commit = useCallback(async (nextEntries) => {
    setEntries(nextEntries)
    const nextVault = { ...vaultRef.current, entries: nextEntries, updatedAt: new Date().toISOString() }
    vaultRef.current = nextVault
    const nextEnvelope = await encryptVault(nextVault, keyRef.current, envelope.salt, envelope.iterations)
    saveEnvelope(nextEnvelope)
    setEnvelope(nextEnvelope)
    onEnvelopeChange(nextEnvelope)
  }, [envelope.iterations, envelope.salt, onEnvelopeChange])

  const resetLockTimer = useCallback(() => {
    window.clearTimeout(lockTimer.current)
    lockTimer.current = window.setTimeout(onLock, timeoutMinutes * 60_000)
  }, [onLock, timeoutMinutes])

  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, resetLockTimer, { passive: true }))
    resetLockTimer()
    return () => { events.forEach((event) => window.removeEventListener(event, resetLockTimer)); window.clearTimeout(lockTimer.current) }
  }, [resetLockTimer])

  const setTimeoutMinutes = (value) => {
    setTimeoutMinutesState(value)
    localStorage.setItem('ciphervault.timeout', String(value))
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return entries
      .filter((entry) => activeFilter === 'All items' || (activeFilter === 'Favorites' ? entry.favorite : entry.category === activeFilter))
      .filter((entry) => !query || [entry.title, entry.username, entry.website, entry.category].some((value) => value?.toLowerCase().includes(query)))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title))
  }, [entries, activeFilter, search])

  const saveEntry = async (form) => {
    const now = new Date().toISOString()
    const nextEntry = form.id ? { ...form, updatedAt: now } : { ...form, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    const next = form.id ? entries.map((entry) => entry.id === form.id ? nextEntry : entry) : [nextEntry, ...entries]
    await commit(next)
    setEditing(null)
    setSelected(nextEntry)
    flash(form.id ? 'Credential updated securely' : 'Credential encrypted and saved')
  }

  const deleteEntry = async (id) => {
    if (!window.confirm('Delete this credential permanently?')) return
    await commit(entries.filter((entry) => entry.id !== id))
    setEditing(null)
    setSelected(null)
    flash('Credential deleted')
  }

  const toggleFavorite = async (id) => {
    const next = entries.map((entry) => entry.id === id ? { ...entry, favorite: !entry.favorite, updatedAt: new Date().toISOString() } : entry)
    await commit(next)
    setSelected((current) => current?.id === id ? next.find((entry) => entry.id === id) : current)
  }

  const copy = async (value, label = 'Password') => {
    try { await navigator.clipboard.writeText(value); flash(`${label} copied to clipboard`) }
    catch { flash('Clipboard access was blocked') }
  }

  const importBackup = async (file) => {
    try {
      const imported = JSON.parse(await file.text())
      if (imported?.version !== 1 || !imported.ciphertext || !imported.salt || !imported.iv) throw new Error()
      if (!window.confirm('Replace your current vault with this encrypted backup?')) return
      saveEnvelope(imported)
      onEnvelopeChange(imported)
      flash('Backup imported. Locking vault…')
      window.setTimeout(onLock, 700)
    } catch { flash('That file is not a valid CipherVault backup') }
  }

  const counts = useMemo(() => ({
    'All items': entries.length,
    Favorites: entries.filter((entry) => entry.favorite).length,
    ...Object.fromEntries(categories.map((category) => [category.value, entries.filter((entry) => entry.category === category.value).length])),
  }), [entries])

  const changeFilter = (filter) => { setActiveFilter(filter); setSelected(null); setSidebarOpen(false) }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
        <Logo />
        <div className="top-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your vault…" /><kbd>⌘ K</kbd></div>
        <div className="top-actions"><button className="generator-button" onClick={() => setShowGenerator(true)}><Sparkles size={16} /> Generator</button><button className="icon-button" onClick={() => setShowSettings(true)} aria-label="Settings"><Settings size={19} /></button><button className="lock-button" onClick={onLock}><LockKeyhole size={16} /><span>Lock vault</span></button></div>
      </header>
      <div className="workspace">
        {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="mobile-sidebar-head"><Logo /><button className="icon-button" onClick={() => setSidebarOpen(false)}><X size={20} /></button></div>
          <button className="add-button" onClick={() => { setEditing({ ...emptyEntry }); setSidebarOpen(false) }}><Plus size={18} /> Add new password</button>
          <nav>
            <p className="nav-label">Vault</p>
            <button className={activeFilter === 'All items' ? 'active' : ''} onClick={() => changeFilter('All items')}><LayoutGrid size={18} />All items <span>{counts['All items']}</span></button>
            <button className={activeFilter === 'Favorites' ? 'active' : ''} onClick={() => changeFilter('Favorites')}><Heart size={18} />Favorites <span>{counts.Favorites}</span></button>
            <p className="nav-label categories-label">Categories</p>
            {categories.map(({ value, icon: Icon, color }) => <button key={value} className={activeFilter === value ? 'active' : ''} onClick={() => changeFilter(value)}><Icon size={18} style={{ color }} />{value} <span>{counts[value]}</span></button>)}
          </nav>
          <div className="sidebar-security"><ShieldCheck size={18} /><div><b>Vault secured</b><small>AES-256 encrypted</small></div><i /></div>
          <button className="sidebar-lock" onClick={onLock}><LogOut size={17} /> Lock & sign out</button>
        </aside>
        <main className="vault-main">
          <div className="vault-heading">
            <div><p className="eyebrow">Encrypted vault</p><h1>{activeFilter}</h1><p>{filtered.length} {filtered.length === 1 ? 'credential' : 'credentials'} securely stored</p></div>
            <button className="primary-button add-desktop" onClick={() => setEditing({ ...emptyEntry })}><Plus size={17} /> Add password</button>
          </div>
          {entries.length > 0 && <div className="security-summary"><span className="summary-icon"><ShieldCheck size={20} /></span><div><b>Your vault is protected</b><p>Every credential is encrypted before it is saved to this device.</p></div><span className="summary-pill"><i /> All secure</span></div>}
          <section className="vault-list">
            {filtered.length ? (
              <>
                <div className="list-header"><span>Login</span><span>Website</span><span>Category</span><span>Password</span><span /></div>
                {filtered.map((entry) => <EntryRow key={entry.id} entry={entry} selected={selected?.id === entry.id} onSelect={setSelected} onCopy={copy} onToggleFavorite={toggleFavorite} />)}
              </>
            ) : (
              <div className="empty-state">
                <span><KeyRound size={30} /></span>
                <h2>{search ? 'No credentials found' : activeFilter === 'All items' ? 'Your vault is ready' : `No ${activeFilter.toLowerCase()} yet`}</h2>
                <p>{search ? 'Try a different name, username, or website.' : 'Add your first login and it will be encrypted before it is stored.'}</p>
                {!search && <button className="primary-button" onClick={() => setEditing({ ...emptyEntry })}><Plus size={17} /> Add your first password</button>}
              </div>
            )}
          </section>
          <footer className="vault-footer"><span><ShieldCheck size={14} /> End-to-end encrypted</span><span>Last encrypted {new Date(envelope.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></footer>
        </main>
        <DetailPanel entry={selected} onClose={() => setSelected(null)} onEdit={setEditing} onCopy={copy} onToggleFavorite={toggleFavorite} />
      </div>
      {editing && <EntryModal entry={editing} onClose={() => setEditing(null)} onSave={saveEntry} onDelete={deleteEntry} />}
      {showGenerator && <PasswordGenerator onClose={() => setShowGenerator(false)} onUse={(password) => { setShowGenerator(false); setEditing({ ...emptyEntry, password }) }} />}
      {showSettings && <SettingsModal timeout={timeoutMinutes} setTimeoutMinutes={setTimeoutMinutes} envelope={envelope} onImport={importBackup} onClose={() => setShowSettings(false)} />}
      <Toast message={toast} />
    </div>
  )
}

export default function App() {
  const [envelope, setEnvelope] = useState(() => loadEnvelope())
  const [session, setSession] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const createVault = async (masterPassword) => {
    setBusy(true)
    setError('')
    try {
      const now = new Date().toISOString()
      const vault = { version: 1, entries: [], createdAt: now, updatedAt: now }
      const result = await createEncryptedVault(masterPassword, vault)
      saveEnvelope(result.envelope)
      setEnvelope(result.envelope)
      setSession({ vault, key: result.key })
    } catch { setError('We could not create the vault. Please try again.') }
    finally { setBusy(false) }
  }

  const unlockVault = async (masterPassword) => {
    setBusy(true)
    setError('')
    try {
      const result = await decryptVault(envelope, masterPassword)
      setSession(result)
    } catch (unlockError) { setError(unlockError.message) }
    finally { setBusy(false) }
  }

  const lock = useCallback(() => {
    setSession(null)
    setError('')
  }, [])

  if (!envelope) return <SetupScreen onComplete={createVault} busy={busy} error={error} />
  if (!session) return <UnlockScreen onUnlock={unlockVault} busy={busy} error={error} />
  return <VaultApp initialVault={session.vault} initialKey={session.key} initialEnvelope={envelope} onLock={lock} onEnvelopeChange={setEnvelope} />
}
