import { Queue } from 'bullmq'
import { SMTPClient } from 'emailjs'
import type { AppConfig } from './config'

export class EmailService {
  private readonly queue: Queue | null

  constructor(private readonly config: AppConfig) {
    this.queue = config.emailDelivery === 'queue' && config.redisUrl
      ? new Queue('ciphervault-email', { connection: { url: config.redisUrl } })
      : null
  }

  async diagnostics(): Promise<{ mode: 'disabled' | 'queue' | 'direct'; waiting: number; failed: number }> {
    if (this.config.emailDelivery === 'disabled') return { mode: 'disabled', waiting: 0, failed: 0 }
    if (!this.queue) return { mode: 'direct', waiting: 0, failed: 0 }
    const [waiting, failed] = await Promise.all([this.queue.getWaitingCount(), this.queue.getFailedCount()])
    return { mode: 'queue', waiting, failed }
  }

  async sendVerification(email: string, token: string): Promise<void> {
    if (this.config.emailDelivery === 'disabled') return
    const url = new URL('/verify-email', this.config.publicOrigin)
    url.searchParams.set('token', token)
    if (this.queue) {
      await this.queue.add('verification', { email, url: url.toString() }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      })
      return
    }

    const client = new SMTPClient({
      host: this.config.smtpHost!,
      port: this.config.smtpPort!,
      ...(this.config.smtpUser ? { user: this.config.smtpUser } : {}),
      ...(this.config.smtpPassword ? { password: this.config.smtpPassword } : {}),
      tls: this.config.smtpPort !== 1025,
      timeout: 10_000,
    })
    try {
      await client.sendAsync({
        from: this.config.smtpFrom!,
        to: email,
        subject: 'Verify your CipherVault account',
        text: `Verify your CipherVault account within 30 minutes: ${url.toString()}\n\nIf you did not create this account, ignore this message.`,
        attachment: [{
          data: `<p>Verify your CipherVault account within 30 minutes.</p><p><a href="${url.toString()}">Verify account</a></p><p>If you did not create this account, ignore this message.</p>`,
          alternative: true,
        }],
      })
    } finally {
      client.smtp.close()
    }
  }

  async sendRecovery(email: string, token: string): Promise<void> {
    if (this.config.emailDelivery === 'disabled') return
    const url = new URL('/recover', this.config.publicOrigin)
    url.searchParams.set('token', token)
    if (this.queue) {
      await this.queue.add('recovery', { email, url: url.toString() }, {
        attempts: 5, backoff: { type: 'exponential', delay: 2_000 }, removeOnComplete: 1_000, removeOnFail: 5_000,
      })
      return
    }
    const client = new SMTPClient({
      host: this.config.smtpHost!, port: this.config.smtpPort!,
      ...(this.config.smtpUser ? { user: this.config.smtpUser } : {}),
      ...(this.config.smtpPassword ? { password: this.config.smtpPassword } : {}),
      tls: this.config.smtpPort !== 1025, timeout: 10_000,
    })
    try {
      await client.sendAsync({
        from: this.config.smtpFrom!, to: email, subject: 'Recover your CipherVault account',
        text: `Continue recovery within 30 minutes: ${url.toString()}\n\nYour offline recovery key is also required.`,
      })
    } finally { client.smtp.close() }
  }
}
