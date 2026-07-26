import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, Clipboard, CreditCard, Download, FileText, Fingerprint, Heart, IdCard, KeyRound,
  LayoutDashboard, LockKeyhole, LogOut, Menu, MoreHorizontal, Plus, RefreshCw, Search,
  Paperclip, Settings, ShieldCheck, Sparkles, Star, Trash2, Upload, X,
} from 'lucide-react'
import type { EncryptedItem, SyncMutation, VaultItem } from '@ciphervault/contracts'
import { approveExtensionGrant, createExtensionGrant, deleteAccount, deleteAttachment as deleteRemoteAttachment, fetchChanges, passwordRange, prelogin, pushMutations, reauthenticate } from '../../api'
import { vaultCrypto } from '../../crypto-client'
import { readableError } from '../../errors'
import { notifyExtensionPairingApproved, requestExtensionPairing } from '../../extension-bridge'
import { passwordHealth } from '../../health'
import { cacheEncryptedItems, getCursor, readEncryptedItems, setCursor } from '../../offline'
import { Logo } from '../../ui/Logo'
import { SettingsDialog } from '../settings/SettingsDialog'
import { TotpCode } from '../totp/TotpCode'
import { parseVaultImport } from '../import-export/vault-import'
import { downloadEncryptedAttachment, uploadEncryptedAttachment } from '../attachments/attachment-service'
import { compromisedPasswordCount } from '../password-health/compromised'
import { ItemEditor } from './ItemEditor'
import { typeIcons, typeLabels } from './item-types'
import { VaultDashboard } from './VaultDashboard'

type View = 'all' | 'favorites' | 'login' | 'secureNote' | 'card' | 'identity' | 'totp' | 'archive' | 'health'

export function VaultScreen({ email, onLock }: { email: string; onLock: () => void }) {
  const [items, setItems] = useState<VaultItem[]>([])
  const [encrypted, setEncrypted] = useState<EncryptedItem[]>([])
  const [view, setView] = useState<View>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<VaultItem | null>(null)
  const [editing, setEditing] = useState<VaultItem | null | undefined>(undefined)
  const [settings, setSettings] = useState(false)
  const [sidebar, setSidebar] = useState(false)
  const [message, setMessage] = useState('Synchronizing encrypted vault...')
  const [compromised, setCompromised] = useState<number | null>(null)
  const [checkingCompromised, setCheckingCompromised] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const importInput = useRef<HTMLInputElement | null>(null)
  const attachmentInput = useRef<HTMLInputElement | null>(null)

  const decryptAll = useCallback(async (records: EncryptedItem[]) => {
    const live = records.filter((item) => !item.deletedAt)
    const decrypted = await Promise.all(live.map((item) => vaultCrypto.decrypt(item)))
    setItems(decrypted)
  }, [])

  const synchronize = useCallback(async () => {
    const local = await readEncryptedItems()
    setEncrypted(local)
    await decryptAll(local)
    let cursor = await getCursor()
    let hasMore = true
    const merged = new Map(local.map((item) => [item.id, item]))
    while (hasMore) {
      const page = await fetchChanges(cursor)
      for (const item of page.items) {
        const current = merged.get(item.id)
        if (!current || item.revision >= current.revision) merged.set(item.id, item)
      }
      cursor = page.cursor
      hasMore = page.hasMore
    }
    const records = [...merged.values()]
    await cacheEncryptedItems(records)
    await setCursor(cursor)
    setEncrypted(records)
    await decryptAll(records)
    setMessage('Vault synchronized securely')
  }, [decryptAll])

  useEffect(() => {
    synchronize().catch((cause) => setMessage(`Offline mode / ${readableError(cause)}`))
  }, [synchronize])
  useEffect(() => {
    if (new URLSearchParams(location.search).get('extension') !== 'pair') return
    let cancelled = false
    const pair = async () => {
      if (!window.confirm('Pair this browser extension with your encrypted vault? You can revoke it from the security dashboard.')) return
      const pairing = await requestExtensionPairing()
      if (!pairing) throw new Error('The CipherVault extension did not respond. Ensure it is installed and the extension ID is configured.')
      const { code } = await createExtensionGrant(pairing)
      const wrappedVaultKey = await vaultCrypto.wrapForExtension(pairing.devicePublicKey.wrapKey)
      await approveExtensionGrant(code, wrappedVaultKey)
      const result = await notifyExtensionPairingApproved(code)
      if (!result?.paired) throw new Error('The extension could not complete the pairing exchange.')
      if (!cancelled) {
        setMessage('Browser extension paired securely')
        history.replaceState({}, '', location.pathname)
      }
    }
    pair().catch((cause) => !cancelled && setMessage(`Extension pairing failed / ${readableError(cause)}`))
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    const reset = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(onLock, 5 * 60_000)
    }
    const events = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((name) => addEventListener(name, reset, { passive: true }))
    reset()
    return () => {
      events.forEach((name) => removeEventListener(name, reset))
      window.clearTimeout(timer.current)
    }
  }, [onLock])

  const filtered = useMemo(() => items.filter((item) => {
    if (view === 'favorites' && !item.favorite) return false
    if (view === 'archive' && !item.archived) return false
    if (!['all', 'favorites', 'archive', 'health'].includes(view) && item.type !== view) return false
    if (view !== 'archive' && item.archived) return false
    const search = query.toLowerCase()
    return !search || [item.name, ...item.tags, ...Object.values(item.fields).map(String)]
      .some((value) => value.toLowerCase().includes(search))
  }), [items, query, view])

  const save = async (item: VaultItem) => {
    const current = encrypted.find((value) => value.id === item.id)
    const record = await vaultCrypto.encrypt(item, current?.revision ?? 0)
    const mutation: SyncMutation = {
      itemId: item.id,
      baseRevision: current?.revision ?? 0,
      encryptedPayload: {
        cryptoVersion: record.cryptoVersion,
        itemVersion: record.itemVersion,
        nonce: record.nonce,
        ciphertext: record.ciphertext,
      },
    }
    try {
      const result = await pushMutations([mutation])
      if (result.conflicts.length) {
        setMessage('A newer version exists on another device. Refresh to resolve it.')
        return false
      }
      const stored = result.accepted[0]
      if (!stored) throw new Error('The server did not accept the item.')
      const next = [...encrypted.filter((value) => value.id !== item.id), stored]
      setEncrypted(next)
      setItems((currentItems) => [...currentItems.filter((value) => value.id !== item.id), item])
      await cacheEncryptedItems(next)
      await setCursor(result.cursor)
      setEditing(undefined)
      setSelected(item)
      setMessage('Encrypted and synchronized')
      return true
    } catch (cause) {
      setMessage(readableError(cause))
      return false
    }
  }

  const remove = async (item: VaultItem) => {
    const current = encrypted.find((value) => value.id === item.id)
    if (!current || !confirm(`Move "${item.name}" to trash?`)) return
    try {
      const result = await pushMutations([{ itemId: item.id, baseRevision: current.revision, tombstone: true }])
      if (result.conflicts.length) {
        setMessage('Delete conflict: refresh the vault.')
        return
      }
      const stored = result.accepted[0]
      if (!stored) throw new Error('The server did not accept the delete.')
      const next = [...encrypted.filter((value) => value.id !== item.id), stored]
      setEncrypted(next)
      setItems((values) => values.filter((value) => value.id !== item.id))
      setSelected(null)
      setEditing(undefined)
      await cacheEncryptedItems(next)
      await setCursor(result.cursor)
      setMessage(`“${item.name}” moved to trash`)
    } catch (cause) {
      setMessage(`Delete failed / ${readableError(cause)}`)
    }
  }

  const downloadJson = (payload: unknown, filename: string) => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }
  const exportEncrypted = () => downloadJson(
    { format: 'ciphervault-encrypted-items', version: 2, exportedAt: new Date().toISOString(), items: encrypted },
    `ciphervault-encrypted-${new Date().toISOString().slice(0, 10)}.json`,
  )
  const exportPlaintext = async (masterPassword: string) => {
    if (!window.confirm('This export contains every decrypted vault secret. Anyone who obtains the file can read them. Continue?')) return
    const challenge = await prelogin(email)
    const derived = await vaultCrypto.deriveAuth(masterPassword, challenge.salt, challenge.kdf)
    await reauthenticate(derived.authKey)
    downloadJson(
      { format: 'ciphervault-plaintext', version: 1, exportedAt: new Date().toISOString(), items },
      `ciphervault-plaintext-${new Date().toISOString().slice(0, 10)}.json`,
    )
  }
  const deleteVaultAccount = async (masterPassword: string, confirmationEmail: string) => {
    if (!window.confirm('Delete this account and revoke every active session? Encrypted data will be permanently purged after seven days.')) return
    const challenge = await prelogin(email)
    const derived = await vaultCrypto.deriveAuth(masterPassword, challenge.salt, challenge.kdf)
    await reauthenticate(derived.authKey)
    await deleteAccount(confirmationEmail)
    onLock()
  }
  const reauthenticateForSettings = async (masterPassword: string) => {
    const challenge = await prelogin(email)
    const derived = await vaultCrypto.deriveAuth(masterPassword, challenge.salt, challenge.kdf)
    await reauthenticate(derived.authKey)
  }

  const importVault = async (file: File) => {
    setMessage('Validating import locally...')
    try {
      const imported = parseVaultImport(file.name, await file.text())
      const mutations: SyncMutation[] = []
      const plaintextItems: VaultItem[] = []
      if (imported.kind === 'plaintext') {
        plaintextItems.push(...imported.items)
        for (const item of imported.items) {
          const record = await vaultCrypto.encrypt(item, 0)
          mutations.push({
            itemId: item.id,
            baseRevision: 0,
            encryptedPayload: {
              cryptoVersion: record.cryptoVersion,
              itemVersion: record.itemVersion,
              nonce: record.nonce,
              ciphertext: record.ciphertext,
            },
          })
        }
      } else {
        // Authentication failure here proves the backup belongs to another vault
        // before any ciphertext mutation is submitted.
        await Promise.all(imported.items.map((record) => vaultCrypto.decrypt(record)))
        for (const record of imported.items) {
          const current = encrypted.find((item) => item.id === record.id)
          mutations.push({
            itemId: record.id,
            baseRevision: current?.revision ?? 0,
            encryptedPayload: {
              cryptoVersion: record.cryptoVersion,
              itemVersion: record.itemVersion,
              nonce: record.nonce,
              ciphertext: record.ciphertext,
            },
          })
        }
      }

      const accepted: EncryptedItem[] = []
      let cursor = await getCursor()
      for (let index = 0; index < mutations.length; index += 100) {
        const result = await pushMutations(mutations.slice(index, index + 100))
        if (result.conflicts.length) throw new Error('The import conflicts with newer synchronized items.')
        accepted.push(...result.accepted)
        cursor = Math.max(cursor, result.cursor)
      }
      const merged = new Map(encrypted.map((record) => [record.id, record]))
      for (const record of accepted) merged.set(record.id, record)
      const next = [...merged.values()]
      await cacheEncryptedItems(next)
      await setCursor(cursor)
      setEncrypted(next)
      if (plaintextItems.length) {
        setItems((current) => [...current, ...plaintextItems])
      } else {
        await decryptAll(next)
      }
      setMessage(`Imported and encrypted ${accepted.length} item${accepted.length === 1 ? '' : 's'}`)
    } catch (cause) {
      setMessage(`Import failed / ${readableError(cause)}`)
    } finally {
      if (importInput.current) importInput.current.value = ''
    }
  }

  const attachFile = async (file: File) => {
    if (!selected) return
    setMessage(`Encrypting attachment ${file.name}...`)
    try {
      const metadata = await uploadEncryptedAttachment(selected.id, file)
      const updated: VaultItem = {
        ...selected,
        updatedAt: new Date().toISOString(),
        attachmentIds: [...(selected.attachmentIds ?? []), metadata.id],
        attachments: [...(selected.attachments ?? []), metadata],
      }
      if (!(await save(updated))) {
        await deleteRemoteAttachment(metadata.id).catch(() => undefined)
        return
      }
      setMessage('Attachment encrypted and synchronized')
    } catch (cause) {
      setMessage(readableError(cause))
    } finally {
      if (attachmentInput.current) attachmentInput.current.value = ''
    }
  }

  const removeAttachment = async (item: VaultItem, attachmentId: string) => {
    await deleteRemoteAttachment(attachmentId)
    await save({
      ...item,
      updatedAt: new Date().toISOString(),
      attachmentIds: (item.attachmentIds ?? []).filter((id) => id !== attachmentId),
      attachments: (item.attachments ?? []).filter((attachment) => attachment.id !== attachmentId),
    })
  }

  const checkCompromisedPasswords = async () => {
    if (!window.confirm('CipherVault will send only anonymous five-character SHA-1 hash prefixes. Passwords and full hashes remain on this device. Continue?')) return
    setCheckingCompromised(true)
    try {
      const passwords = items
        .filter((item) => item.type === 'login')
        .map((item) => String(item.fields.password ?? ''))
        .filter(Boolean)
      const count = await compromisedPasswordCount(passwords, passwordRange)
      setCompromised(count)
      setMessage(`Compromised-password check completed locally: ${count} match${count === 1 ? '' : 'es'}`)
    } catch (cause) {
      setMessage(readableError(cause))
    } finally {
      setCheckingCompromised(false)
    }
  }

  const health = useMemo(() => passwordHealth(items), [items])
  const navigation: Array<{ id: View; label: string; icon: typeof KeyRound }> = [
    { id: 'all', label: 'All items', icon: LayoutDashboard }, { id: 'favorites', label: 'Favorites', icon: Heart },
    { id: 'login', label: 'Logins', icon: KeyRound }, { id: 'secureNote', label: 'Secure notes', icon: FileText },
    { id: 'card', label: 'Cards', icon: CreditCard }, { id: 'identity', label: 'Identities', icon: IdCard },
    { id: 'totp', label: 'Authenticator', icon: Fingerprint }, { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'health', label: 'Password health', icon: ShieldCheck },
  ]

  return <div className="app-shell production-shell"><header className="topbar"><button className="mobile-menu" onClick={() => setSidebar(true)}><Menu size={20} /></button><Logo /><div className="top-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search decrypted items on this device..." /></div><div className="top-actions"><button className="generator-button" onClick={() => setEditing(null)}><Sparkles size={16} /> New item</button><button className="icon-button" onClick={() => setSettings(true)}><Settings size={18} /></button><button className="lock-button" onClick={onLock}><LockKeyhole size={16} /><span>Lock</span></button></div></header>
    <div className="workspace">{sidebar && <button className="sidebar-scrim" onClick={() => setSidebar(false)} />}<aside className={`sidebar ${sidebar ? 'open' : ''}`}><div className="mobile-sidebar-head"><Logo light /><button className="icon-button" onClick={() => setSidebar(false)}><X size={18} /></button></div><button className="add-button" onClick={() => { setEditing(null); setSidebar(false) }}><Plus size={17} /> Add vault item</button><nav><p className="nav-label">Your vault</p>{navigation.map(({ id, label, icon: Icon }, index) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setSidebar(false); setSelected(null) }}><Icon size={17} />{label}{index < 7 && <span>{id === 'all' ? items.length : id === 'favorites' ? items.filter((item) => item.favorite).length : items.filter((item) => item.type === id).length}</span>}</button>)}</nav><div className="sidebar-security"><ShieldCheck size={17} /><div><b>Zero-knowledge vault</b><small>{email}</small></div><i /></div><button className="sidebar-lock" onClick={onLock}><LogOut size={16} /> Lock & sign out</button></aside>
      <main className="vault-main"><div className="vault-heading"><div><p className="eyebrow">Encrypted personal vault</p><h1>{navigation.find((item) => item.id === view)?.label}</h1><p>{message}</p></div><div className="heading-actions"><input ref={importInput} className="visually-hidden" type="file" accept=".csv,.json,application/json,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importVault(file) }} /><button className="secondary-button" onClick={() => importInput.current?.click()}><Upload size={15} /> Import</button><button className="secondary-button" onClick={exportEncrypted}><Download size={15} /> Backup</button><button className="primary-button" onClick={() => setEditing(null)}><Plus size={16} /> Add item</button></div></div>
        {view === 'all' && <VaultDashboard items={items} health={health} compromised={compromised} loading={message.startsWith('Synchronizing')} onSelect={setSelected} onNavigate={(next) => { setView(next); setSelected(null) }} onToggleFavorite={(item) => void save({ ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() })} />}
        {view === 'health' ? <section className="health-grid"><article><span className="health-icon safe"><ShieldCheck /></span><b>{health.total - health.weak}</b><p>Strong passwords</p></article><article><span className="health-icon warning"><KeyRound /></span><b>{health.weak}</b><p>Weak passwords</p></article><article><span className="health-icon danger"><RefreshCw /></span><b>{health.reused}</b><p>Reused passwords</p></article><article><span className="health-icon danger"><ShieldCheck /></span><b>{compromised ?? '-'}</b><p>Compromised passwords</p></article><div className="health-note"><ShieldCheck size={20} /><div><b>Health checks happen locally</b><p>Passwords are analyzed in memory. Compromised checks are opt-in and send only k-anonymous hash prefixes.</p><button className="secondary-button" disabled={checkingCompromised} onClick={() => void checkCompromisedPasswords()}>{checkingCompromised ? 'Checking anonymous ranges...' : 'Check compromised passwords'}</button></div></div></section> : <section className="vault-list production-list">{filtered.length ? <>{filtered.map((item) => { const Icon = typeIcons[item.type]; const username = String(item.fields.username ?? item.fields.email ?? item.fields.issuer ?? typeLabels[item.type]); return <button className={`production-row ${selected?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setSelected(item)}><span className="site-avatar"><Icon size={18} /></span><span className="entry-primary"><b>{item.name}</b><small>{username}</small></span><span className="item-tags">{item.tags.slice(0, 2).map((tag) => <i key={tag}>{tag}</i>)}</span><span className="item-type">{typeLabels[item.type]}</span><Star className={item.favorite ? 'favorite-star' : ''} size={17} fill={item.favorite ? 'currentColor' : 'none'} /><MoreHorizontal size={17} /></button> })}</> : <div className="empty-state"><span><KeyRound size={29} /></span><h2>Your encrypted vault is ready</h2><p>Add a login, note, card, identity, or authenticator secret. It is encrypted before synchronization.</p><button className="primary-button" onClick={() => setEditing(null)}><Plus size={16} /> Add first item</button></div>}</section>}
        <footer className="vault-footer"><span><ShieldCheck size={14} /> End-to-end encrypted</span><span>Server stores ciphertext only</span></footer>
      </main>
      {selected && <aside className="detail-panel production-detail"><div className="detail-top"><button className="icon-button" onClick={() => setSelected(null)}><X size={18} /></button><div><button className="icon-button" onClick={() => setEditing(selected)}><Settings size={16} /></button><button className="icon-button danger-icon" onClick={() => void remove(selected)}><Trash2 size={16} /></button></div></div><div className="detail-identity"><span className="detail-avatar">{(() => { const Icon = typeIcons[selected.type]; return <Icon size={27} /> })()}</span><h2>{selected.name}</h2><p>{typeLabels[selected.type]}</p></div>{selected.type === 'totp' && Boolean(selected.fields.secret) && <TotpCode secret={String(selected.fields.secret)} />}<div className="detail-fields">{Object.entries(selected.fields).filter(([, value]) => value).map(([key, value]) => <div className="detail-field" key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><div><b className={key === 'password' || key === 'secret' ? 'mono secret-value' : ''}>{key === 'password' || key === 'secret' ? '************' : String(value)}</b><button className="icon-button subtle" onClick={() => navigator.clipboard.writeText(String(value))}><Clipboard size={14} /></button></div></div>)}</div><div className="attachment-list">{(selected.attachments ?? []).map((attachment) => <div key={attachment.id}><button onClick={() => void downloadEncryptedAttachment(attachment)}><Paperclip size={14} /><span><b>{attachment.name}</b><small>{Math.ceil(attachment.size / 1024)} KiB</small></span></button><button className="icon-button danger-icon" aria-label={`Delete ${attachment.name}`} onClick={() => void removeAttachment(selected, attachment.id)}><Trash2 size={14} /></button></div>)}<input ref={attachmentInput} className="visually-hidden" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void attachFile(file) }} /><button className="secondary-button full" onClick={() => attachmentInput.current?.click()}><Paperclip size={14} /> Add encrypted attachment</button></div><div className="detail-footer"><ShieldCheck size={14} /> Decrypted only on this device</div></aside>}
    </div>
    {editing !== undefined && <ItemEditor {...(editing ? { existing: editing } : {})} onSave={(item) => void save(item)} onClose={() => setEditing(undefined)} />}
    {settings && <SettingsDialog onClose={() => setSettings(false)} onLock={onLock} onPlaintextExport={exportPlaintext} onDeleteAccount={deleteVaultAccount} onReauthenticate={reauthenticateForSettings} />}
  </div>
}
