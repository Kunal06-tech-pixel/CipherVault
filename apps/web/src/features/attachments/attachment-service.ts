import type { VaultItem } from '@ciphervault/contracts'
import { attachmentDownload, completeAttachment, deleteAttachment, initiateAttachment } from '../../api'
import { vaultCrypto } from '../../crypto-client'

const CHUNK_BYTES = 64 * 1024

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '')
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
}

export async function uploadEncryptedAttachment(itemId: string, file: File): Promise<NonNullable<VaultItem['attachments']>[number]> {
  if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('Attachments must be between 1 byte and 10 MiB.')
  const id = crypto.randomUUID()
  const chunkCount = Math.ceil(file.size / CHUNK_BYTES)
  const encryptedChunks: Uint8Array[] = []
  const nonces: string[] = []
  for (let chunk = 0; chunk < chunkCount; chunk += 1) {
    const bytes = new Uint8Array(await file.slice(chunk * CHUNK_BYTES, (chunk + 1) * CHUNK_BYTES).arrayBuffer())
    const encrypted = await vaultCrypto.encryptAttachment(bytes, id, chunk, chunkCount)
    encryptedChunks.push(encrypted.ciphertext)
    nonces.push(encrypted.nonce)
  }
  const combined = new Uint8Array(encryptedChunks.reduce((total, chunk) => total + chunk.length, 0))
  let offset = 0
  for (const chunk of encryptedChunks) { combined.set(chunk, offset); offset += chunk.length }
  const reservation = await initiateAttachment({
    id, itemId, size: file.size, chunkCount, cryptoVersion: 2, ciphertextSha256: await sha256(combined),
  })
  try {
    const hashes: string[] = []
    for (let chunk = 0; chunk < encryptedChunks.length; chunk += 1) {
      const bytes = encryptedChunks[chunk]
      const url = reservation.uploadUrls[chunk]
      if (!bytes || !url) throw new Error('Attachment upload reservation is incomplete.')
      const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const response = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body })
      if (!response.ok) throw new Error('An encrypted attachment chunk could not be uploaded.')
      hashes.push(await sha256(bytes))
    }
    await completeAttachment(id, hashes)
    return { id, name: file.name, contentType: file.type || 'application/octet-stream', size: file.size, nonces }
  } catch (error) {
    await deleteAttachment(id).catch(() => undefined)
    throw error
  }
}

export async function downloadEncryptedAttachment(metadata: NonNullable<VaultItem['attachments']>[number]): Promise<void> {
  const { downloadUrls } = await attachmentDownload(metadata.id)
  if (downloadUrls.length !== metadata.nonces.length) throw new Error('Attachment chunk metadata does not match the server record.')
  const plaintext: Uint8Array[] = []
  for (let chunk = 0; chunk < downloadUrls.length; chunk += 1) {
    const response = await fetch(downloadUrls[chunk]!)
    if (!response.ok) throw new Error('An encrypted attachment chunk could not be downloaded.')
    const ciphertext = new Uint8Array(await response.arrayBuffer())
    plaintext.push(await vaultCrypto.decryptAttachment(ciphertext, metadata.nonces[chunk]!, metadata.id, chunk, downloadUrls.length))
  }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob(plaintext as BlobPart[], { type: metadata.contentType }))
  link.download = metadata.name
  link.click()
  URL.revokeObjectURL(link.href)
}
