import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

/** Where uploaded files live. Local disk for 0.1; swap for S3/R2/Blob when hosted. */
export interface FileStore {
  put(data: Buffer, opts: { contentType: string; prefix: string }): Promise<{ key: string }>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const KEY_RE = /^[a-z0-9-]+\/[0-9a-f-]{36}$/;

export class LocalFileStore implements FileStore {
  constructor(private root: string) {}

  private resolve(key: string) {
    if (!KEY_RE.test(key)) throw new Error(`Invalid file key: ${key}`);
    return path.join(this.root, key);
  }

  async put(data: Buffer, { prefix }: { contentType: string; prefix: string }) {
    if (!/^[a-z0-9-]+$/.test(prefix)) throw new Error(`Invalid prefix: ${prefix}`);
    const key = `${prefix}/${randomUUID()}`;
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return { key };
  }

  get(key: string) {
    return readFile(this.resolve(key));
  }

  delete(key: string) {
    return rm(this.resolve(key), { force: true });
  }
}

let store: FileStore | undefined;

export function fileStore(): FileStore {
  store ??= new LocalFileStore(path.resolve(env().STORAGE_DIR));
  return store;
}
