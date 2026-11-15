import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";

/**
 * Where uploaded files live (textbook photos and PDFs from the track chat).
 * Local disk in development and tests; a private, encrypted S3 bucket in production (FILE_STORE=s3).
 * Files are written once and deleted later. To delete, call discardFiles() (jobs/files.ts), not delete():
 * it queues a retried job so a file is never left behind because one request failed.
 */
export interface FileStore {
  put(data: Buffer, opts: { contentType: string; prefix: string }): Promise<{ key: string }>;
  get(key: string): Promise<Buffer>;
  /** Deletes the given keys; keys that don't exist are not an error. */
  delete(keys: string[]): Promise<void>;
}

const KEY_RE = /^[a-z0-9-]+\/[0-9a-f-]{36}$/;
const PREFIX_RE = /^[a-z0-9-]+$/;

function newKey(prefix: string) {
  if (!PREFIX_RE.test(prefix)) throw new Error(`Invalid prefix: ${prefix}`);
  return `${prefix}/${randomUUID()}`;
}

function checkKey(key: string) {
  if (!KEY_RE.test(key)) throw new Error(`Invalid file key: ${key}`);
  return key;
}

export class LocalFileStore implements FileStore {
  constructor(private root: string) {}

  private resolve(key: string) {
    return path.join(this.root, checkKey(key));
  }

  async put(data: Buffer, { prefix }: { contentType: string; prefix: string }) {
    const key = newKey(prefix);
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return { key };
  }

  get(key: string) {
    return readFile(this.resolve(key));
  }

  async delete(keys: string[]) {
    await Promise.all(keys.map((k) => rm(this.resolve(k), { force: true })));
  }
}

/** Private bucket; every object is encrypted at rest (SSE-S3). Credentials come from the standard AWS environment. */
export class S3FileStore implements FileStore {
  constructor(
    private client: Pick<S3Client, "send">,
    private bucket: string,
  ) {}

  async put(data: Buffer, { contentType, prefix }: { contentType: string; prefix: string }) {
    const key = newKey(prefix);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType, ServerSideEncryption: "AES256" }),
    );
    return { key };
  }

  async get(key: string) {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: checkKey(key) }));
    if (!out.Body) throw new Error(`Empty file: ${key}`);
    return Buffer.from(await out.Body.transformToByteArray());
  }

  async delete(keys: string[]) {
    // S3 deletes up to 1,000 keys per request; a missing key counts as deleted.
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000).map((k) => ({ Key: checkKey(k) }));
      const out = await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: batch, Quiet: true } }));
      if (out.Errors?.length) throw new Error(`S3 could not delete ${out.Errors.length} file(s): ${out.Errors[0]!.Code} ${out.Errors[0]!.Message}`);
    }
  }
}

let store: FileStore | undefined;

export function fileStore(): FileStore {
  if (!store) {
    const e = env();
    store = e.FILE_STORE === "s3" ? new S3FileStore(new S3Client({ region: e.AWS_REGION }), e.S3_BUCKET!) : new LocalFileStore(path.resolve(e.STORAGE_DIR));
  }
  return store;
}
