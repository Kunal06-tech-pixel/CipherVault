import type { EncryptedItem } from '@ciphervault/contracts'

const DATABASE_NAME = 'ciphervault-encrypted-cache-v2'
const DATABASE_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('items')) database.createObjectStore('items', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('metadata')) database.createObjectStore('metadata')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function cacheEncryptedItems(items: EncryptedItem[]): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction('items', 'readwrite')
  const store = transaction.objectStore('items')
  for (const item of items) store.put(item)
  await completion(transaction)
  database.close()
}

export async function readEncryptedItems(): Promise<EncryptedItem[]> {
  const database = await openDatabase()
  const transaction = database.transaction('items', 'readonly')
  const request = transaction.objectStore('items').getAll()
  const result = await new Promise<EncryptedItem[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as EncryptedItem[])
    request.onerror = () => reject(request.error)
  })
  database.close()
  return result
}

export async function getCursor(): Promise<number> {
  const database = await openDatabase()
  const transaction = database.transaction('metadata', 'readonly')
  const request = transaction.objectStore('metadata').get('cursor')
  const result = await new Promise<number>((resolve, reject) => {
    request.onsuccess = () => resolve(typeof request.result === 'number' ? request.result : 0)
    request.onerror = () => reject(request.error)
  })
  database.close()
  return result
}

export async function setCursor(cursor: number): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction('metadata', 'readwrite')
  transaction.objectStore('metadata').put(cursor, 'cursor')
  await completion(transaction)
  database.close()
}

export async function clearOfflineCache(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Encrypted cache is open in another tab.'))
  })
}
