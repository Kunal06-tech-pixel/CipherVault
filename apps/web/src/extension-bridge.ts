declare global {
  interface Window {
    chrome?: {
      runtime?: {
        lastError?: { message?: string }
        sendMessage: (
          extensionId: string,
          message: unknown,
          callback: (response?: unknown) => void,
        ) => void
      }
    }
  }
}

export interface ExtensionPairingRequest {
  pkceChallenge: string
  devicePublicKey: { wrapKey: JsonWebKey; signingKey: JsonWebKey }
  label: string
}

function messageExtension<T>(message: unknown): Promise<T | null> {
  const extensionId = import.meta.env.VITE_EXTENSION_ID
  if (!extensionId || !window.chrome?.runtime?.sendMessage) return Promise.resolve(null)
  return new Promise((resolve) => {
    window.chrome!.runtime!.sendMessage(extensionId, message, (response) => {
      if (window.chrome?.runtime?.lastError) resolve(null)
      else resolve((response as T | undefined) ?? null)
    })
  })
}

export function requestExtensionPairing(): Promise<ExtensionPairingRequest | null> {
  return messageExtension<ExtensionPairingRequest>({ type: 'pairing-request' })
}

export function notifyExtensionPairingApproved(code: string): Promise<{ paired: boolean } | null> {
  return messageExtension<{ paired: boolean }>({ type: 'pairing-approved', code })
}
