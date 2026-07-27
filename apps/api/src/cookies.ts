import type { AppConfig } from './config'

export function browserSessionSameSite(config: AppConfig): 'none' | 'strict' {
  return config.cookieSecure ? 'none' : 'strict'
}
