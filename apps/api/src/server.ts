import { buildApp } from './app'
import { loadConfig } from './config'

const config = loadConfig()
const app = await buildApp(config)

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutdown_requested')
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

try {
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
