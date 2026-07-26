/// <reference lib="webworker" />
import type { EncryptedItem, KdfParameters, VaultItem, WrappedVaultKey } from '@ciphervault/contracts'
import {
  createRecoveryKey,
  decodeRecoveryKey,
  decryptItem,
  decryptAttachmentChunk,
  deriveMasterKeys,
  encryptItem,
  encryptAttachmentChunk,
  fromBase64Url,
  randomBytes,
  recoveryWrapVaultKey,
  recoveryUnwrapVaultKey,
  toBase64Url,
  unwrapVaultKey,
  wrapVaultKey,
  zeroize,
} from '@ciphervault/crypto'

let vaultKey: Uint8Array | null = null
let pendingWrappingKey: CryptoKey | null = null

type Message =
  | { id: number; type: 'register'; masterPassword: string }
  | { id: number; type: 'deriveAuth'; masterPassword: string; salt: string; kdf: KdfParameters }
  | { id: number; type: 'unlock'; wrappedVaultKey: WrappedVaultKey }
  | { id: number; type: 'recover'; recoveryKey: string; recoveryEnvelope: { cryptoVersion: 2; nonce: string; ciphertext: string }; newMasterPassword: string }
  | { id: number; type: 'encrypt'; item: VaultItem; revision: number }
  | { id: number; type: 'decrypt'; item: EncryptedItem }
  | { id: number; type: 'encryptAttachment'; bytes: Uint8Array; attachmentId: string; chunkIndex: number; chunkCount: number }
  | { id: number; type: 'decryptAttachment'; ciphertext: Uint8Array; nonce: string; attachmentId: string; chunkIndex: number; chunkCount: number }
  | { id: number; type: 'wrapForExtension'; publicKey: JsonWebKey }
  | { id: number; type: 'lock' }

self.onmessage = async (event: MessageEvent<Message>) => {
  const message = event.data
  try {
    let result: unknown
    switch (message.type) {
      case 'register': {
        const salt = randomBytes(16)
        const keys = await deriveMasterKeys(message.masterPassword, salt)
        const nextVaultKey = randomBytes(32)
        const wrappedVaultKey = await wrapVaultKey(nextVaultKey, keys.wrappingKey, salt)
        const recovery = await createRecoveryKey()
        const recoveryWrappedVaultKey = await recoveryWrapVaultKey(nextVaultKey, recovery.bytes)
        zeroize(vaultKey)
        vaultKey = nextVaultKey
        pendingWrappingKey = keys.wrappingKey
        result = {
          authKey: toBase64Url(keys.authKey),
          wrappedVaultKey,
          recoveryWrappedVaultKey,
          recoveryKey: recovery.encoded,
        }
        zeroize(keys.authKey)
        zeroize(recovery.bytes)
        break
      }
      case 'deriveAuth': {
        const keys = await deriveMasterKeys(message.masterPassword, fromBase64Url(message.salt), message.kdf)
        pendingWrappingKey = keys.wrappingKey
        result = { authKey: toBase64Url(keys.authKey) }
        zeroize(keys.authKey)
        break
      }
      case 'unlock': {
        if (!pendingWrappingKey) throw new Error('Authentication derivation is missing.')
        zeroize(vaultKey)
        vaultKey = await unwrapVaultKey(message.wrappedVaultKey, pendingWrappingKey)
        pendingWrappingKey = null
        result = true
        break
      }
      case 'recover': {
        const recoveryBytes = await decodeRecoveryKey(message.recoveryKey)
        const nextVaultKey = await recoveryUnwrapVaultKey(message.recoveryEnvelope, recoveryBytes)
        const salt = randomBytes(16)
        const keys = await deriveMasterKeys(message.newMasterPassword, salt)
        const wrappedVaultKey = await wrapVaultKey(nextVaultKey, keys.wrappingKey, salt)
        zeroize(vaultKey)
        vaultKey = nextVaultKey
        result = { authKey: toBase64Url(keys.authKey), wrappedVaultKey }
        zeroize(keys.authKey)
        zeroize(recoveryBytes)
        break
      }
      case 'encrypt':
        if (!vaultKey) throw new Error('Vault is locked.')
        result = await encryptItem(message.item, vaultKey, message.revision)
        break
      case 'decrypt':
        if (!vaultKey) throw new Error('Vault is locked.')
        result = await decryptItem(message.item, vaultKey)
        break
      case 'encryptAttachment':
        if (!vaultKey) throw new Error('Vault is locked.')
        result = await encryptAttachmentChunk(message.bytes, vaultKey, message.attachmentId, message.chunkIndex, message.chunkCount)
        break
      case 'decryptAttachment':
        if (!vaultKey) throw new Error('Vault is locked.')
        result = await decryptAttachmentChunk(message.ciphertext, message.nonce, vaultKey, message.attachmentId, message.chunkIndex, message.chunkCount)
        break
      case 'wrapForExtension': {
        if (!vaultKey) throw new Error('Vault is locked.')
        const publicKey = await crypto.subtle.importKey(
          'jwk', message.publicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'],
        )
        const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, Uint8Array.from(vaultKey).buffer)
        result = toBase64Url(new Uint8Array(wrapped))
        break
      }
      case 'lock':
        zeroize(vaultKey)
        vaultKey = null
        pendingWrappingKey = null
        result = true
        break
    }
    self.postMessage({ id: message.id, result })
  } catch (error) {
    self.postMessage({ id: message.id, error: error instanceof Error ? error.message : 'Cryptographic operation failed.' })
  }
}
