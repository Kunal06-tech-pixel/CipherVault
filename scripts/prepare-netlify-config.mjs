import { readFileSync, writeFileSync } from 'node:fs'

const marker = 'CIPHERVAULT_CONNECT_SRC'
const netlifyConfigPath = new URL('../netlify.toml', import.meta.url)
const apiUrl = process.env.VITE_API_URL
const extraConnectSrc = process.env.CIPHERVAULT_CSP_CONNECT_SRC_EXTRA ?? ''

if (!apiUrl) {
  console.error('VITE_API_URL is required for Netlify deploys, for example https://ciphervault-api.onrender.com')
  process.exit(1)
}

function originFrom(value) {
  try {
    return new URL(value).origin
  } catch {
    console.error(`Invalid URL in Netlify CSP config: ${value}`)
    process.exit(1)
  }
}

const origins = [
  originFrom(apiUrl),
  ...extraConnectSrc
    .split(/[,\s]+/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(originFrom),
]

const uniqueOrigins = [...new Set(origins)]
const config = readFileSync(netlifyConfigPath, 'utf8')

if (!config.includes(marker)) {
  console.error(`Cannot find ${marker} in netlify.toml. Restore the placeholder before building on Netlify.`)
  process.exit(1)
}

writeFileSync(netlifyConfigPath, config.replaceAll(marker, uniqueOrigins.join(' ')))
console.log(`Prepared Netlify CSP connect-src for: ${uniqueOrigins.join(', ')}`)
