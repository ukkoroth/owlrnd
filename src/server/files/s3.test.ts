import { DeleteObjectsCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { S3FileStore } from "./index";

/** A stand-in S3 client that records commands and can report per-key errors. */
function fakeClient(deleteErrors: { Code: string; Message: string }[] = []) {
  const sent: unknown[] = [];
  return {
    sent,
    client: {
      send: async (cmd: unknown) => {
        sent.push(cmd);
        return cmd instanceof DeleteObjectsCommand ? { Errors: deleteErrors } : {};
      },
    } as never,
  };
}

const KEY = "track-material/0b6a3c3e-6a52-4c39-9a0e-2f1e7f1f4d6a";

describe("S3FileStore", () => {
  it("stores each file privately under a new key, encrypted at rest, with its content type", async () => {
    const { client, sent } = fakeClient();
    const { key } = await new S3FileStore(client, "uploads").put(Buffer.from("x"), { contentType: "image/jpeg", prefix: "track-material" });
    expect(key).toMatch(/^track-material\/[0-9a-f-]{36}$/);
    const put = sent[0] as PutObjectCommand;
    expect(put).toBeInstanceOf(PutObjectCommand);
    expect(put.input).toMatchObject({ Bucket: "uploads", Key: key, ContentType: "image/jpeg", ServerSideEncryption: "AES256" });
    expect(put.input).not.toHaveProperty("ACL");
  });

  it("deletes in batches of at most 1,000 keys", async () => {
    const { client, sent } = fakeClient();
    const keys = Array.from({ length: 2300 }, (_, i) => `track-material/${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`);
    await new S3FileStore(client, "uploads").delete(keys);
    expect(sent.map((c) => (c as DeleteObjectsCommand).input.Delete!.Objects!.length)).toEqual([1000, 1000, 300]);
  });

  it("fails (so the job retries) when S3 reports a key it could not delete", async () => {
    const { client } = fakeClient([{ Code: "AccessDenied", Message: "denied" }]);
    await expect(new S3FileStore(client, "uploads").delete([KEY])).rejects.toThrow(/AccessDenied/);
  });

  it("refuses keys and prefixes that could escape the uploads layout", async () => {
    const { client } = fakeClient();
    const store = new S3FileStore(client, "uploads");
    await expect(store.delete(["../other/secret"])).rejects.toThrow(/Invalid file key/);
    await expect(store.put(Buffer.from("x"), { contentType: "image/png", prefix: "../x" })).rejects.toThrow(/Invalid prefix/);
  });
});
