/**
 * Live check of the uploads bucket (FILE_STORE=s3): npm run s3:check
 * Writes a small file, confirms it is encrypted at rest and reads back intact, deletes it, and confirms it is gone.
 * Uses the same settings as the app (.env.local or the server's environment).
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const { HeadObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
const { env } = await import("@/server/env");
const { fileStore } = await import("@/server/files");

async function main() {
  const e = env();
  if (e.FILE_STORE !== "s3") throw new Error("FILE_STORE is not s3; nothing to check.");
  const store = fileStore();
  const body = Buffer.from(`owlrnd s3:check ${new Date().toISOString()}`);

  const { key } = await store.put(body, { contentType: "text/plain", prefix: "healthcheck" });
  const head = await new S3Client({ region: e.AWS_REGION }).send(new HeadObjectCommand({ Bucket: e.S3_BUCKET!, Key: key }));
  const readBack = (await store.get(key)).equals(body);
  await store.delete([key]);
  const gone = await store.get(key).then(() => false, () => true);
  await store.delete([key]); // deleting again must not fail (the delete job retries)

  console.log(`bucket ${e.S3_BUCKET} (${e.AWS_REGION})`);
  console.log(`  write, then read back intact: ${readBack ? "ok" : "FAILED"}`);
  console.log(`  encrypted at rest: ${head.ServerSideEncryption === "AES256" ? "ok (AES256)" : `FAILED (${head.ServerSideEncryption})`}`);
  console.log(`  delete, then gone: ${gone ? "ok" : "FAILED"}`);
  if (!readBack || head.ServerSideEncryption !== "AES256" || !gone) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
