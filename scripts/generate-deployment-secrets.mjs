import { randomBytes } from 'node:crypto'

const secret = (bytes = 32) => randomBytes(bytes).toString('base64url')

console.log(`AUTH_PEPPER=${secret(32)}`)
console.log(`PRELOGIN_SECRET=${secret(32)}`)
console.log(`MFA_ENCRYPTION_KEY=${secret(32)}`)
