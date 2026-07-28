import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export const productionCsp = [
  "default-src 'self'",
  // hash-wasm's Argon2 path compiles embedded WASM in the crypto worker.
  // Some browsers still gate that behind unsafe-eval despite wasm-unsafe-eval.
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' http://localhost:3001 http://127.0.0.1:3001",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

// Vite's development runtime injects a refresh preamble and browser tooling may
// evaluate generated code.
// This relaxation is never emitted by the production build or preview server.
export const developmentCsp = productionCsp
  .replace(
    "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'",
    "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' 'unsafe-inline'",
  )
  .replace(
    "connect-src 'self' http://localhost:3001 http://127.0.0.1:3001",
    "connect-src 'self' http://localhost:3001 http://127.0.0.1:3001 ws://localhost:5173 ws://127.0.0.1:5173",
  )

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    headers: { 'Content-Security-Policy': developmentCsp },
  },
  preview: { headers: { 'Content-Security-Policy': productionCsp } },
  build: { sourcemap: true, target: 'es2022' },
  worker: { format: 'es' },
})
