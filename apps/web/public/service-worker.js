const CACHE_NAME = 'ciphervault-static-v2-beta2'
const SHELL_URLS = ['/', '/manifest.webmanifest?v=gold-20260726', '/icon.svg?v=gold-20260726']

function isCacheableStaticRequest(request) {
  if (request.method !== 'GET') return false
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return false
  if (url.pathname.startsWith('/v1/') || url.pathname.startsWith('/health/')) return false
  return ['document', 'script', 'style', 'worker', 'font', 'image', 'manifest'].includes(request.destination)
}

async function cacheShell() {
  const cache = await caches.open(CACHE_NAME)
  const response = await fetch('/', { cache: 'no-store', credentials: 'same-origin' })
  if (!response.ok) throw new Error('Could not cache the application shell.')
  await cache.put('/', response.clone())

  const html = await response.text()
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"#]+)"/gu)]
    .map((match) => match[1])
    .filter((path) => path?.startsWith('/'))
  await cache.addAll([...new Set([...SHELL_URLS.slice(1), ...assetPaths])])
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith('ciphervault-static-') && name !== CACHE_NAME).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (!isCacheableStaticRequest(request)) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) await (await caches.open(CACHE_NAME)).put('/', response.clone())
      return response
    }).catch(async () => (await caches.open(CACHE_NAME)).match('/') ?? Response.error()))
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') await (await caches.open(CACHE_NAME)).put(request, response.clone())
    return response
  })())
})
