import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, Download, Heart, KeyRound,
  LayoutDashboard, LockKeyhole, LogOut, Menu, MoreHorizontal, Plus, RefreshCw, Search,
  Settings, ShieldCheck, Star, Upload, X,
} from 'lucide-react'
import type { EncryptedItem, SyncMutation, VaultItem, VaultItemType } from '@keywall/contracts'
import { approveExtensionGrant, createExtensionGrant, deleteAccount, deleteAttachment as deleteRemoteAttachment, fetchChanges, passwordRange, prelogin, pushMutations, reauthenticate } from '../../api'
import { vaultCrypto } from '../../crypto-client'
import { readableError } from '../../errors'
import { notifyExtensionPairingApproved, requestExtensionPairing } from '../../extension-bridge'
import { passwordHealth } from '../../health'
import { cacheEncryptedItems, getCursor, readEncryptedItems, setCursor } from '../../offline'
import { Logo } from '../../ui/Logo'
import { SettingsDialog } from '../settings/SettingsDialog'
import { parseVaultImport } from '../import-export/vault-import'
import { downloadEncryptedAttachment, uploadEncryptedAttachment } from '../attachments/attachment-service'
import { compromisedPasswordCount } from '../password-health/compromised'
import { ItemEditor } from './ItemEditor'
import { dashboardTypeOrder, typeIcons, typeLabels } from './item-types'
import { VaultDashboard } from './VaultDashboard'
import { normalizeVaultItem } from './vault-item-normalize'
import { searchableValues, safeSubtitle } from './vault-item-validation'
import { ReauthenticationDialog } from './ReauthenticationDialog'
import { VaultItemDetails } from './VaultItemDetails'
import { LockStatus3D } from '../../components/3d/LockStatus3D'

export type View = 'all' | 'favorites' | VaultItemType | 'archive' | 'health' | 'recent'

const attachmentsEnabled = import.meta.env.VITE_ENABLE_ATTACHMENTS === 'true'

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
  const [reauthRequest, setReauthRequest] = useState<{ reason: string; action: () => void } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const importInput = useRef<HTMLInputElement | null>(null)
  const attachmentInput = useRef<HTMLInputElement | null>(null)

  const decryptAll = useCallback(async (records: EncryptedItem[]) => {
    const live = records.filter((item) => !item.deletedAt)
    const decrypted = (await Promise.all(live.map((item) => vaultCrypto.decrypt(item)))).map((item) => normalizeVaultItem(item))
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
      if (!pairing) throw new Error('The Keywall extension did not respond. Ensure it is installed and the extension ID is configured.')
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
    if (!['all', 'favorites', 'archive', 'health', 'recent'].includes(view) && item.type !== view) return false
    if (view !== 'archive' && item.archived) return false
    const search = query.toLowerCase()
    return !search || searchableValues(item)
      .some((value) => value.toLowerCase().includes(search))
  }).sort((left, right) => {
    if (view === 'recent') return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    return left.name.localeCompare(right.name)
  }), [items, query, view])

  const save = async (item: VaultItem) => {
    const normalizedItem = normalizeVaultItem(item)
    const current = encrypted.find((value) => value.id === item.id)
    const record = await vaultCrypto.encrypt(normalizedItem, current?.revision ?? 0)
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
      setItems((currentItems) => [...currentItems.filter((value) => value.id !== item.id), normalizedItem])
      await cacheEncryptedItems(next)
      await setCursor(result.cursor)
      setEditing(undefined)
      setSelected(normalizedItem)
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
    requireReauthentication('Deleting a vault item requires recent reauthentication.', () => {
      void removeAfterReauth(item, current)
    })
  }

  const removeAfterReauth = async (item: VaultItem, current: EncryptedItem) => {
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
    { format: 'keywall-encrypted-items', version: 2, exportedAt: new Date().toISOString(), items: encrypted },
    `keywall-encrypted-${new Date().toISOString().slice(0, 10)}.json`,
  )
  const exportPlaintext = async (masterPassword: string) => {
    if (!window.confirm('This export contains every decrypted vault secret. Anyone who obtains the file can read them. Continue?')) return
    const challenge = await prelogin(email)
    const derived = await vaultCrypto.deriveAuth(masterPassword, challenge.salt, challenge.kdf)
    await reauthenticate(derived.authKey)
    downloadJson(
      { format: 'keywall-plaintext', version: 1, exportedAt: new Date().toISOString(), items },
      `keywall-plaintext-${new Date().toISOString().slice(0, 10)}.json`,
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
  const requireReauthentication = (reason: string, action: () => void) => setReauthRequest({ reason, action })
  const confirmReauthentication = async (masterPassword: string) => {
    await reauthenticateForSettings(masterPassword)
    const action = reauthRequest?.action
    setReauthRequest(null)
    action?.()
  }
  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setMessage('Value copied to clipboard')
      window.setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => undefined)
      }, 30_000)
    } catch {
      setMessage('Clipboard access was blocked')
    }
  }

  const importVault = async (file: File) => {
    setMessage('Validating import locally...')
    try {
      const imported = parseVaultImport(file.name, await file.text())
      const mutations: SyncMutation[] = []
      const plaintextItems: VaultItem[] = []
      if (imported.kind === 'plaintext') {
        const normalized = imported.items.map((item) => normalizeVaultItem(item))
        plaintextItems.push(...normalized)
        for (const item of normalized) {
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
    if (!attachmentsEnabled) {
      setMessage('Attachments are disabled on the free deployment.')
      return
    }
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
    if (!attachmentsEnabled) {
      setMessage('Attachments are disabled on the free deployment.')
      return
    }
    await deleteRemoteAttachment(attachmentId)
    await save({
      ...item,
      updatedAt: new Date().toISOString(),
      attachmentIds: (item.attachmentIds ?? []).filter((id) => id !== attachmentId),
      attachments: (item.attachments ?? []).filter((attachment) => attachment.id !== attachmentId),
    })
  }

  const checkCompromisedPasswords = async () => {
    if (!window.confirm('Keywall will send only anonymous five-character SHA-1 hash prefixes. Passwords and full hashes remain on this device. Continue?')) return
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

  const mainNavigation: Array<{ id: View; label: string; icon: typeof KeyRound }> = [
    { id: 'all', label: 'All items', icon: LayoutDashboard },
    { id: 'favorites', label: 'Favorites', icon: Heart },
    { id: 'recent', label: 'Recently updated', icon: RefreshCw },
  ]

  const categoryNavigation: Array<{ id: View; label: string; icon: typeof KeyRound }> = [
    ...dashboardTypeOrder.map((id) => ({ id, label: typeLabels[id], icon: typeIcons[id] })),
  ]

  const systemNavigation: Array<{ id: View; label: string; icon: typeof KeyRound }> = [
    { id: 'health', label: 'Login health', icon: ShieldCheck },
    { id: 'archive', label: 'Archive', icon: Archive },
  ]

  const allNavigation = [...mainNavigation, ...categoryNavigation, ...systemNavigation]

  const countFor = (id: View) => {
    if (id === 'all') return items.filter((item) => !item.archived).length
    if (id === 'favorites') return items.filter((item) => item.favorite && !item.archived).length
    if (id === 'archive') return items.filter((item) => item.archived).length
    if (id === 'recent') return items.filter((item) => !item.archived).length
    if (id === 'health') return health.total
    return items.filter((item) => item.type === id && !item.archived).length
  }

  const activeNav = allNavigation.find((item) => item.id === view)

  return (
    <div className="app-shell production-shell">
      {/* Topbar Header */}
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setSidebar(true)} aria-label="Open sidebar menu">
          <Menu size={18} />
        </button>
        <Logo />
        
        <div className="top-search">
          <Search size={15} className="search-icon" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search decrypted items..."
          />
          <kbd className="search-shortcut">⌘K</kbd>
        </div>

        <div className="top-actions">
          <button className="primary-button add-cta" onClick={() => setEditing(null)}>
            <Plus size={15} /> New item
          </button>
          <button className="icon-button" onClick={() => setSettings(true)} aria-label="Settings">
            <Settings size={17} />
          </button>
          <button className="lock-button" onClick={onLock} aria-label="Lock vault">
            <LockStatus3D isLocked={false} size={24} />
            <span>Lock</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="workspace">
        {sidebar && <button className="sidebar-scrim" onClick={() => setSidebar(false)} />}
        
        <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
          <div className="mobile-sidebar-head">
            <Logo light />
            <button className="icon-button" onClick={() => setSidebar(false)}>
              <X size={18} />
            </button>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-group">
              <p className="nav-label">Vault Overview</p>
              {mainNavigation.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`nav-item ${view === id ? 'active' : ''}`}
                  onClick={() => { setView(id); setSidebar(false); setSelected(null) }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  <em className="nav-count">{countFor(id)}</em>
                </button>
              ))}
            </div>

            <div className="nav-group">
              <p className="nav-label">Item Categories</p>
              {categoryNavigation.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`nav-item ${view === id ? 'active' : ''}`}
                  onClick={() => { setView(id); setSidebar(false); setSelected(null) }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  <em className="nav-count">{countFor(id)}</em>
                </button>
              ))}
            </div>

            <div className="nav-group">
              <p className="nav-label">Security & Trash</p>
              {systemNavigation.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`nav-item ${view === id ? 'active' : ''}`}
                  onClick={() => { setView(id); setSidebar(false); setSelected(null) }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  <em className="nav-count">{countFor(id)}</em>
                </button>
              ))}
            </div>
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-security">
              <ShieldCheck size={16} />
              <div className="user-info">
                <b>Encrypted vault</b>
                <small>{email}</small>
              </div>
            </div>
            <button className="sidebar-lock-btn" onClick={onLock}>
              <LogOut size={15} /> Lock & sign out
            </button>
          </div>
        </aside>

        <main className="vault-main">
          {/* Page Header */}
          <div className="vault-heading">
            <div className="heading-title-group">
              <div className="title-row">
                <h1>{activeNav?.label}</h1>
                <span className="view-count-badge">{countFor(view)} {countFor(view) === 1 ? 'item' : 'items'}</span>
              </div>
              <p className="heading-sub">{message}</p>
            </div>

            <div className="heading-actions">
              <input
                ref={importInput}
                className="visually-hidden"
                type="file"
                accept=".csv,.json,application/json,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void importVault(file)
                }}
              />
              <button className="secondary-button" onClick={() => importInput.current?.click()}>
                <Upload size={14} /> Import
              </button>
              <button className="secondary-button" onClick={exportEncrypted}>
                <Download size={14} /> Backup
              </button>
            </div>
          </div>

          {/* View Content */}
          {view === 'all' && (
            <VaultDashboard
              items={items}
              health={health}
              compromised={compromised}
              loading={message.startsWith('Synchronizing')}
              onSelect={setSelected}
              onNavigate={(next) => { setView(next); setSelected(null) }}
              onToggleFavorite={(item) => void save({ ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() })}
            />
          )}

          {view === 'health' ? (
            <section className="health-grid">
              <article>
                <span className="health-icon safe"><ShieldCheck size={18} /></span>
                <b>{health.total - health.weak}</b>
                <p>Strong login passwords</p>
              </article>
              <article>
                <span className="health-icon warning"><KeyRound size={18} /></span>
                <b>{health.weak}</b>
                <p>Weak login passwords</p>
              </article>
              <article>
                <span className="health-icon danger"><RefreshCw size={18} /></span>
                <b>{health.reused}</b>
                <p>Reused login passwords</p>
              </article>
              <article>
                <span className="health-icon danger"><ShieldCheck size={18} /></span>
                <b>{compromised ?? '-'}</b>
                <p>Compromised logins</p>
              </article>
              
              <div className="health-note">
                <ShieldCheck size={20} />
                <div>
                  <b>Login health checks happen locally</b>
                  <p>Passwords are analyzed in memory. Compromised checks are opt-in and send only k-anonymous hash prefixes.</p>
                  <button className="secondary-button" disabled={checkingCompromised} onClick={() => void checkCompromisedPasswords()}>
                    {checkingCompromised ? 'Checking anonymous ranges...' : 'Check compromised logins'}
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section id="complete-vault-list" className="vault-list production-list">
              {filtered.length ? (
                <>
                  {filtered.map((item) => {
                    const Icon = typeIcons[item.type]
                    return (
                      <button
                        className={`production-row ${selected?.id === item.id ? 'selected' : ''}`}
                        key={item.id}
                        onClick={() => setSelected(item)}
                      >
                        <span className="site-avatar">
                          <Icon size={16} />
                        </span>
                        <span className="entry-primary">
                          <b>{item.name}</b>
                          <small>{safeSubtitle(item)}</small>
                        </span>
                        <span className="item-tags">
                          {[item.category, ...item.tags].slice(0, 2).map((tag) => (
                            <i key={tag}>{tag}</i>
                          ))}
                        </span>
                        <span className="item-type">{typeLabels[item.type]}</span>
                        <Star
                          className={item.favorite ? 'favorite-star' : ''}
                          size={16}
                          fill={item.favorite ? 'currentColor' : 'none'}
                        />
                        <MoreHorizontal size={16} className="row-more-icon" />
                      </button>
                    )
                  })}
                </>
              ) : (
                <div className="empty-state">
                  <span><KeyRound size={26} /></span>
                  <h2>No encrypted items found</h2>
                  <p>Add a secure item to store logins, cards, or notes encrypted on your device.</p>
                  <button className="primary-button" onClick={() => setEditing(null)}>
                    <Plus size={15} /> Add first item
                  </button>
                </div>
              )}
            </section>
          )}

          <footer className="vault-footer">
            <span><ShieldCheck size={13} /> End-to-end encrypted</span>
            <span>Server stores ciphertext only</span>
          </footer>
        </main>

        {selected && (
          <VaultItemDetails
            item={selected}
            attachmentsEnabled={attachmentsEnabled}
            onClose={() => setSelected(null)}
            onEdit={() => setEditing(selected)}
            onDelete={() => void remove(selected)}
            onAttach={() => attachmentInput.current?.click()}
            onDownloadAttachment={(attachment) => void downloadEncryptedAttachment(attachment)}
            onDeleteAttachment={(attachmentId) => void removeAttachment(selected, attachmentId)}
            onRequireReauth={requireReauthentication}
            onCopy={(value) => void copyValue(value)}
          />
        )}
        
        {attachmentsEnabled && (
          <input
            ref={attachmentInput}
            className="visually-hidden"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void attachFile(file)
            }}
          />
        )}
      </div>

      {editing !== undefined && (
        <ItemEditor
          {...(editing ? { existing: editing } : {})}
          onSave={(item) => void save(item)}
          onClose={() => setEditing(undefined)}
        />
      )}

      {reauthRequest && (
        <ReauthenticationDialog
          reason={reauthRequest.reason}
          onCancel={() => setReauthRequest(null)}
          onConfirm={confirmReauthentication}
        />
      )}

      {settings && (
        <SettingsDialog
          onClose={() => setSettings(false)}
          onLock={onLock}
          onPlaintextExport={exportPlaintext}
          onDeleteAccount={deleteVaultAccount}
          onReauthenticate={reauthenticateForSettings}
        />
      )}
    </div>
  )
}

