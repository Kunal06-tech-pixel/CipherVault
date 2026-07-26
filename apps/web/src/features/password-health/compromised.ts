export async function sha1Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', data))
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export async function compromisedPasswordCount(
  passwords: string[],
  fetchRange: (prefix: string) => Promise<string>,
): Promise<number> {
  const hashes = await Promise.all([...new Set(passwords.filter(Boolean))].map(sha1Hex))
  const ranges = new Map<string, Map<string, number>>()
  for (const prefix of new Set(hashes.map((hash) => hash.slice(0, 5)))) {
    const response = await fetchRange(prefix)
    ranges.set(prefix, new Map(response.split(/\r?\n/u).map((line) => {
      const [suffix = '', count = '0'] = line.trim().split(':')
      return [suffix, Number(count)]
    })))
  }
  return hashes.filter((hash) => (ranges.get(hash.slice(0, 5))?.get(hash.slice(5)) ?? 0) > 0).length
}
