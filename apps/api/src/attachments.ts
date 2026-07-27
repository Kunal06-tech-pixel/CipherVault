import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutBucketCorsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { AppConfig } from './config'

type AttachmentConfig = AppConfig & {
  s3Endpoint: string
  s3PublicEndpoint: string
  s3Region: string
  s3Bucket: string
  s3AccessKey: string
  s3SecretKey: string
}

export class AttachmentStorage {
  private readonly client: S3Client
  private readonly publicClient: S3Client
  private readonly attachmentConfig: AttachmentConfig

  constructor(private readonly config: AppConfig) {
    if (!config.s3Endpoint || !config.s3PublicEndpoint || !config.s3Region || !config.s3Bucket || !config.s3AccessKey || !config.s3SecretKey) {
      throw new Error('Attachment storage is not configured. Set ENABLE_ATTACHMENTS=true only when S3-compatible storage is configured.')
    }
    this.attachmentConfig = config as AttachmentConfig
    this.client = new S3Client({
      endpoint: config.s3Endpoint,
      region: config.s3Region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.s3AccessKey, secretAccessKey: config.s3SecretKey },
    })
    this.publicClient = new S3Client({
      endpoint: config.s3PublicEndpoint,
      region: config.s3Region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.s3AccessKey, secretAccessKey: config.s3SecretKey },
    })
  }

  async ensureBucket(): Promise<void> {
    try { await this.client.send(new HeadBucketCommand({ Bucket: this.attachmentConfig.s3Bucket })) }
    catch { await this.client.send(new CreateBucketCommand({ Bucket: this.attachmentConfig.s3Bucket })) }
    try {
      await this.client.send(new PutBucketCorsCommand({
        Bucket: this.attachmentConfig.s3Bucket,
        CORSConfiguration: { CORSRules: [{
          AllowedOrigins: [new URL(this.attachmentConfig.publicOrigin).origin],
          AllowedMethods: ['GET', 'PUT'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['etag'],
          MaxAgeSeconds: 3600,
        }] },
      }))
    } catch (error) {
      // MinIO configures API CORS at the server level and intentionally returns
      // NotImplemented for S3 bucket CORS. Other storage failures must surface.
      if ((error as { name?: string }).name !== 'NotImplemented') throw error
    }
  }

  objectKey(userId: string, attachmentId: string, chunk: number): string {
    return `${userId}/${attachmentId}/${chunk.toString().padStart(3, '0')}.bin`
  }

  async uploadUrls(userId: string, attachmentId: string, chunkCount: number): Promise<string[]> {
    return Promise.all(Array.from({ length: chunkCount }, (_, chunk) => getSignedUrl(this.publicClient, new PutObjectCommand({
      Bucket: this.attachmentConfig.s3Bucket,
      Key: this.objectKey(userId, attachmentId, chunk),
      ContentType: 'application/octet-stream',
    }), { expiresIn: 10 * 60 })))
  }

  async downloadUrls(userId: string, attachmentId: string, chunkCount: number): Promise<string[]> {
    return Promise.all(Array.from({ length: chunkCount }, (_, chunk) => getSignedUrl(this.publicClient, new GetObjectCommand({
      Bucket: this.attachmentConfig.s3Bucket,
      Key: this.objectKey(userId, attachmentId, chunk),
      ResponseContentType: 'application/octet-stream',
    }), { expiresIn: 5 * 60 })))
  }

  async verifyChunks(userId: string, attachmentId: string, chunkCount: number, maximumBytes: number): Promise<number> {
    let total = 0
    for (let chunk = 0; chunk < chunkCount; chunk += 1) {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.attachmentConfig.s3Bucket, Key: this.objectKey(userId, attachmentId, chunk) }))
      total += result.ContentLength ?? 0
    }
    if (total < 1 || total > maximumBytes) throw new Error('Uploaded attachment size does not match its reservation.')
    return total
  }

  async deleteChunks(userId: string, attachmentId: string, chunkCount: number): Promise<void> {
    await Promise.all(Array.from({ length: chunkCount }, (_, chunk) => this.client.send(new DeleteObjectCommand({
      Bucket: this.attachmentConfig.s3Bucket, Key: this.objectKey(userId, attachmentId, chunk),
    }))))
  }
}
