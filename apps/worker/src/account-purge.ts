import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3'
import type { Sql } from 'postgres'

export interface AccountPurgeConfig {
  endpoint: string
  region: string
  bucket: string
  accessKey: string
  secretKey: string
}

export class AccountPurger {
  private readonly client: S3Client

  constructor(private readonly config: AccountPurgeConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    })
  }

  async purge(database: Sql): Promise<number> {
    const accounts = await database<Array<{ id: string }>>`
      select id::text as id from users
      where deleted_at is not null and purge_after <= now()
      order by purge_after asc limit 10
    `
    let purged = 0
    for (const account of accounts) {
      const attachments = await database<Array<{ id: string; chunkCount: number }>>`
        select id::text as id, chunk_count as "chunkCount"
        from attachments where user_id = ${account.id}
      `
      const keys = attachments.flatMap((attachment) => Array.from(
        { length: attachment.chunkCount },
        (_, chunk) => `${account.id}/${attachment.id}/${chunk.toString().padStart(3, '0')}.bin`,
      ))
      for (let index = 0; index < keys.length; index += 1000) {
        await this.client.send(new DeleteObjectsCommand({
          Bucket: this.config.bucket,
          Delete: { Quiet: true, Objects: keys.slice(index, index + 1000).map((Key) => ({ Key })) },
        }))
      }
      const deleted = await database`
        delete from users where id = ${account.id} and deleted_at is not null and purge_after <= now()
        returning id
      `
      purged += deleted.count
    }
    return purged
  }
}
