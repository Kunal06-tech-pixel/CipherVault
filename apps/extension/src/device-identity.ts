const DATABASE = 'ciphervault-extension-identity'
const STORE = 'keys'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readKey(name: string): Promise<CryptoKey | null> {
  const database = await openDatabase()
  return new Promise<CryptoKey | null>((resolve, reject) => {
    const request = database.transaction(STORE).objectStore(STORE).get(name)
    request.onsuccess = () => resolve((request.result as CryptoKey | undefined) ?? null)
    request.onerror = () => reject(request.error)
  }).finally(() => database.close())
}

async function writeKey(name: string, key: CryptoKey): Promise<void> {
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(key, name)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  }).finally(() => database.close())
}

export async function deviceIdentity(): Promise<{
  wrapPrivateKey: CryptoKey
  signingPrivateKey: CryptoKey
  publicKeys: { wrapKey: JsonWebKey; signingKey: JsonWebKey }
}> {
  let wrapPrivateKey = await readKey('wrap-private')
  let signingPrivateKey = await readKey('sign-private')
  let wrapPublicKey = await readKey('wrap-public')
  let signingPublicKey = await readKey('sign-public')
  if (!wrapPrivateKey || !wrapPublicKey) {
    const pair = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      false,
      ['encrypt', 'decrypt'],
    )
    wrapPrivateKey = pair.privateKey; wrapPublicKey = pair.publicKey
    await writeKey('wrap-private', wrapPrivateKey); await writeKey('wrap-public', wrapPublicKey)
  }
  if (!signingPrivateKey || !signingPublicKey) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
    signingPrivateKey = pair.privateKey; signingPublicKey = pair.publicKey
    await writeKey('sign-private', signingPrivateKey); await writeKey('sign-public', signingPublicKey)
  }
  return {
    wrapPrivateKey,
    signingPrivateKey,
    publicKeys: {
      wrapKey: await crypto.subtle.exportKey('jwk', wrapPublicKey),
      signingKey: await crypto.subtle.exportKey('jwk', signingPublicKey),
    },
  }
}
