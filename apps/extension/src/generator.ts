function randomIndex(max: number): number {
  if (!Number.isSafeInteger(max) || max < 1) throw new Error('Invalid random range.')
  const ceiling = Math.floor(0x1_0000_0000 / max) * max
  const buffer = new Uint32Array(1)
  do crypto.getRandomValues(buffer)
  while ((buffer[0] ?? 0) >= ceiling)
  return (buffer[0] ?? 0) % max
}

export function generatePassword(length = 20): string {
  if (!Number.isInteger(length) || length < 12 || length > 128) throw new Error('Password length must be between 12 and 128.')
  const groups = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%^&*_-+=?']
  const result = groups.map((group) => group[randomIndex(group.length)] ?? '')
  const pool = groups.join('')
  while (result.length < length) result.push(pool[randomIndex(pool.length)] ?? '')
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomIndex(index + 1)
    ;[result[index], result[target]] = [result[target] ?? '', result[index] ?? '']
  }
  return result.join('')
}
