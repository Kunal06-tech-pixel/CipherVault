import type { EncryptedItem, KdfParameters, VaultItem, WrappedVaultKey } from '@ciphervault/contracts'
import type { RecoveryEnvelope } from '@ciphervault/crypto'
import cryptoWorkerAssetUrl from './crypto.worker.ts?worker&url'

type RegistrationMaterial = {
  authKey: string
  wrappedVaultKey: WrappedVaultKey
  recoveryWrappedVaultKey: RecoveryEnvelope
  recoveryKey: string
}

// Chromium applies Trusted Types to Worker script URLs when
// require-trusted-types-for is enabled. Keep the policy narrowly scoped to
// Vite's bundled worker URL; no dynamic script content is accepted.
const workerUrl = (() => {
  const url = new URL(cryptoWorkerAssetUrl, import.meta.url).toString()
  const trustedTypes = (globalThis as typeof globalThis & { trustedTypes?: { createPolicy: (name: string, rules: { createScriptURL: (value: string) => string }) => { createScriptURL: (value: string) => unknown } } }).trustedTypes
  return trustedTypes?.createPolicy('default', { createScriptURL: (value) => value }).createScriptURL(url) ?? url
})()

export class VaultCryptoClient {
  private readonly worker = new Worker(workerUrl as string | URL, { type: 'module' })
  private counter = 0
  private failure: Error | null = null
  private pending = new Map<number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }>()

  constructor() {
    this.worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const operation = this.pending.get(event.data.id)
      if (!operation) return
      this.pending.delete(event.data.id)
      clearTimeout(operation.timeout)
      if (event.data.error) operation.reject(new Error(event.data.error))
      else operation.resolve(event.data.result)
    }

    this.worker.onerror = (event) => {
      event.preventDefault()
      this.rejectAll(new Error(
        event.message
          ? `Cryptographic worker failed: ${event.message}`
          : 'Cryptographic worker failed to start. Check the browser Content Security Policy.',
      ))
    }

    this.worker.onmessageerror = () => {
      this.rejectAll(new Error('The browser could not read the cryptographic worker response.'))
    }
  }

  private rejectAll(error: Error) {
    this.failure = error
    for (const operation of this.pending.values()) {
      clearTimeout(operation.timeout)
      operation.reject(error)
    }
    this.pending.clear()
  }

  private call<T>(message: Record<string, unknown>): Promise<T> {
    if (this.failure) return Promise.reject(this.failure)

    const id = ++this.counter
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('The cryptographic operation timed out. Please retry on this device.'))
      }, 60_000)

      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout })
      try {
        this.worker.postMessage({ id, ...message })
      } catch (error) {
        clearTimeout(timeout)
        this.pending.delete(id)
        reject(error instanceof Error ? error : new Error('Could not contact the cryptographic worker.'))
      }
    })
  }

  register(masterPassword: string) {
    return this.call<RegistrationMaterial>({ type: 'register', masterPassword })
  }

  deriveAuth(masterPassword: string, salt: string, kdf: KdfParameters) {
    return this.call<{ authKey: string }>({ type: 'deriveAuth', masterPassword, salt, kdf })
  }

  unlock(wrappedVaultKey: WrappedVaultKey) {
    return this.call<boolean>({ type: 'unlock', wrappedVaultKey })
  }

  recover(recoveryKey: string, recoveryEnvelope: RecoveryEnvelope, newMasterPassword: string) {
    return this.call<{ authKey: string; wrappedVaultKey: WrappedVaultKey }>({
      type: 'recover', recoveryKey, recoveryEnvelope, newMasterPassword,
    })
  }

  encrypt(item: VaultItem, revision: number) {
    return this.call<EncryptedItem>({ type: 'encrypt', item, revision })
  }

  decrypt(item: EncryptedItem) {
    return this.call<VaultItem>({ type: 'decrypt', item })
  }

  encryptAttachment(bytes: Uint8Array, attachmentId: string, chunkIndex: number, chunkCount: number) {
    return this.call<{ nonce: string; ciphertext: Uint8Array }>({
      type: 'encryptAttachment', bytes, attachmentId, chunkIndex, chunkCount,
    })
  }

  decryptAttachment(ciphertext: Uint8Array, nonce: string, attachmentId: string, chunkIndex: number, chunkCount: number) {
    return this.call<Uint8Array>({
      type: 'decryptAttachment', ciphertext, nonce, attachmentId, chunkIndex, chunkCount,
    })
  }

  wrapForExtension(publicKey: JsonWebKey) {
    return this.call<string>({ type: 'wrapForExtension', publicKey })
  }

  lock() {
    // A crashed worker cannot retain key material, so locking is already complete.
    if (this.failure) return Promise.resolve(false)
    return this.call<boolean>({ type: 'lock' })
  }

  destroy() {
    this.rejectAll(new Error('The vault was locked.'))
    this.worker.terminate()
  }
}

export const vaultCrypto = new VaultCryptoClient()
