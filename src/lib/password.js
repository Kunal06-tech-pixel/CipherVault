const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const NUMBERS = '23456789'
const SYMBOLS = '!@#$%^&*_-+=?'

function randomIndex(max) {
  const ceiling = Math.floor(0x100000000 / max) * max
  const buffer = new Uint32Array(1)
  do crypto.getRandomValues(buffer)
  while (buffer[0] >= ceiling)
  return buffer[0] % max
}

export function generatePassword(options = {}) {
  const {
    length = 20,
    lowercase = true,
    uppercase = true,
    numbers = true,
    symbols = true,
  } = options
  const groups = [
    lowercase && LOWER,
    uppercase && UPPER,
    numbers && NUMBERS,
    symbols && SYMBOLS,
  ].filter(Boolean)
  if (!groups.length) return ''

  const password = groups.map((group) => group[randomIndex(group.length)])
  const pool = groups.join('')
  while (password.length < length) password.push(pool[randomIndex(pool.length)])

  for (let index = password.length - 1; index > 0; index -= 1) {
    const target = randomIndex(index + 1)
    ;[password[index], password[target]] = [password[target], password[index]]
  }
  return password.join('')
}

export function passwordScore(password) {
  if (!password) return { score: 0, label: 'No password', color: '#a8b2c1' }
  let pool = 0
  if (/[a-z]/.test(password)) pool += 26
  if (/[A-Z]/.test(password)) pool += 26
  if (/\d/.test(password)) pool += 10
  if (/[^A-Za-z0-9]/.test(password)) pool += 24
  const entropy = password.length * Math.log2(Math.max(pool, 1))
  if (entropy >= 100) return { score: 4, label: 'Very strong', color: '#14b87a' }
  if (entropy >= 75) return { score: 3, label: 'Strong', color: '#2f9bdf' }
  if (entropy >= 50) return { score: 2, label: 'Fair', color: '#e3a12d' }
  return { score: 1, label: 'Weak', color: '#e35d6a' }
}

export function hostname(value) {
  if (!value) return ''
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace('www.', '')
  } catch {
    return value
  }
}
