import type { FastifyInstance } from 'fastify'
import { attachmentCompleteSchema, attachmentInitiateSchema } from '@keywall/contracts'
import { requireAuthentication, type ApiContext } from '../api-context'

export function registerAttachmentRoutes(app: FastifyInstance, context: ApiContext): void {
  const { database, attachments } = context
  if (!attachments) throw new Error('Attachment routes require configured attachment storage.')
  const attachmentRateLimit = { max: 60, timeWindow: '1 minute' }

  app.post('/v1/attachments/initiate', { preHandler: requireAuthentication, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = attachmentInitiateSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const reserved = await database.reserveAttachment(parsed.data, request.auth!.user.id)
    if (!reserved) return reply.code(413).send({ error: 'attachment_quota_exceeded' })
    try {
      await attachments.ensureBucket()
      return reply.code(201).send({
        attachment: reserved,
        uploadUrls: await attachments.uploadUrls(request.auth!.user.id, reserved.id, reserved.chunkCount),
        expiresInSeconds: 600,
      })
    } catch (error) {
      await database.deleteAttachment(reserved.id, request.auth!.user.id)
      request.log.error({ error }, 'attachment_storage_unavailable')
      return reply.code(503).send({ error: 'attachment_storage_unavailable' })
    }
  })

  app.post('/v1/attachments/:id/complete', { preHandler: requireAuthentication, config: { rateLimit: attachmentRateLimit } }, async (request, reply) => {
    const id = (request.params as { id: string }).id
    const parsed = attachmentCompleteSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const attachment = await database.findAttachment(id, request.auth!.user.id)
    if (!attachment || attachment.status !== 'pending') return reply.code(404).send({ error: 'attachment_not_found' })
    if (parsed.data.chunkSha256.length !== attachment.chunkCount) return reply.code(400).send({ error: 'chunk_count_mismatch' })
    try {
      await attachments.verifyChunks(request.auth!.user.id, id, attachment.chunkCount, attachment.size + attachment.chunkCount * 16)
    } catch {
      return reply.code(400).send({ error: 'attachment_verification_failed' })
    }
    if (!(await database.completeAttachment(id, request.auth!.user.id, parsed.data.chunkSha256))) {
      return reply.code(409).send({ error: 'attachment_state_conflict' })
    }
    return { completed: true }
  })

  app.get('/v1/attachments/:id', { preHandler: requireAuthentication, config: { rateLimit: attachmentRateLimit } }, async (request, reply) => {
    const id = (request.params as { id: string }).id
    const attachment = await database.findAttachment(id, request.auth!.user.id)
    if (!attachment || attachment.status !== 'complete') return reply.code(404).send({ error: 'attachment_not_found' })
    return {
      attachment,
      downloadUrls: await attachments.downloadUrls(request.auth!.user.id, id, attachment.chunkCount),
      expiresInSeconds: 300,
    }
  })

  app.delete('/v1/attachments/:id', { preHandler: requireAuthentication, config: { rateLimit: attachmentRateLimit } }, async (request, reply) => {
    const id = (request.params as { id: string }).id
    const attachment = await database.deleteAttachment(id, request.auth!.user.id)
    if (!attachment) return reply.code(404).send({ error: 'attachment_not_found' })
    await attachments.deleteChunks(request.auth!.user.id, id, attachment.chunkCount)
      .catch((error) => request.log.error({ error }, 'attachment_cleanup_failed'))
    return reply.code(204).send()
  })
}
