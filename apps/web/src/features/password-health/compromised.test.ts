import { describe, expect, it } from 'vitest'
import { compromisedPasswordCount, sha1Hex } from './compromised'

describe('k-anonymous password checks', () => {
  it('hashes locally with the expected SHA-1 representation', async () => {
    expect(await sha1Hex('password')).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8')
  })

  it('sends only five-character prefixes to the range provider', async () => {
    const prefixes: string[] = []
    const count = await compromisedPasswordCount(['password'], async (prefix) => {
      prefixes.push(prefix)
      return '1E4C9B93F3F0682250B6CF8331B7EE68FD8:42\nFFFF:0'
    })
    expect(prefixes).toEqual(['5BAA6'])
    expect(count).toBe(1)
  })
})
