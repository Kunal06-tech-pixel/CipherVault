import type { AppConfig } from './config'

type OriginConfig = Pick<AppConfig, 'nodeEnv' | 'publicOrigin'>

export function allowedWebOrigins(config: OriginConfig): string[] {
  const configured = new URL(config.publicOrigin)
  const origins = new Set([configured.origin])

  if (config.nodeEnv !== 'production' && ['localhost', '127.0.0.1'].includes(configured.hostname)) {
    for (const hostname of ['localhost', '127.0.0.1']) {
      const loopback = new URL(configured.origin)
      loopback.hostname = hostname
      origins.add(loopback.origin)
    }
  }

  return [...origins]
}

export function isAllowedWebOrigin(origin: string, allowedOrigins: readonly string[]): boolean {
  try {
    return allowedOrigins.includes(new URL(origin).origin)
  } catch {
    return false
  }
}

export function isAllowedMutationOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  // Non-browser clients may omit Origin. Browsers always attach it to cross-origin
  // CORS requests, so a supplied value must match the configured web application.
  return origin === undefined || isAllowedWebOrigin(origin, allowedOrigins)
}

export function isExtensionOrigin(origin: string | undefined): boolean {
  return origin === undefined || /^chrome-extension:\/\/[a-p]{32}$/u.test(origin) || /^moz-extension:\/\/[0-9a-f-]{36}$/u.test(origin)
}
