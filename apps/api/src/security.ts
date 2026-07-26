import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'

export function opaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('base64url')
}

export function fakePreloginSalt(secret: string, email: string): string {
  return createHmac('sha256', secret).update(email).digest('base64url').slice(0, 22)
}

export async function hashAuthKey(authKey: string, pepper: string): Promise<string> {
  return hash(`${authKey}:${pepper}`, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  })
}

export async function verifyAuthKey(storedHash: string, authKey: string, pepper: string): Promise<boolean> {
  try {
    return await verify(storedHash, `${authKey}:${pepper}`)
  } catch {
    return false
  }
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
