import type { VaultItem } from '@keywall/contracts'

export function passwordHealth(items: VaultItem[]): { total: number; strong: number; weak: number; reused: number } {
  const passwords = items.filter((item) => item.type === 'login').map((item) => String(item.fields.password ?? '')).filter(Boolean)
  const frequencies = new Map<string, number>()
  for (const password of passwords) frequencies.set(password, (frequencies.get(password) ?? 0) + 1)
  const reused = passwords.filter((password) => (frequencies.get(password) ?? 0) > 1).length
  const weak = passwords.filter((password) => password.length < 12 || !/[A-Z]/u.test(password) || !/\d/u.test(password)).length
  return { total: passwords.length, strong: passwords.length - weak, weak, reused }
}
