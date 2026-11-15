import "server-only";
import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().url(),
    EMAIL_TRANSPORT: z.enum(["console", "smtp", "postmark"]).default("console"),
    SMTP_URL: z.string().default("smtp://localhost:1025"),
    POSTMARK_SERVER_TOKEN: z.string().optional(),
    EMAIL_FROM: z.string().default("owlrnd <codes@example.com>"),
    ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
    /** "local" keeps uploads in STORAGE_DIR (development, tests); "s3" uses S3_BUCKET (production). */
    FILE_STORE: z.enum(["local", "s3"]).default("local"),
    STORAGE_DIR: z.string().default("./storage"),
    S3_BUCKET: z.string().optional(),
    AWS_REGION: z.string().default("ap-south-1"),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    /** Public address of the app, used in links inside emails (invitations). No trailing slash. */
    APP_URL: z.string().url().default("http://localhost:3000"),
    /** Where new access requests are announced. Optional: without it, requests are only recorded. */
    OWNER_EMAIL: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  })
  .refine((e) => e.FILE_STORE !== "s3" || !!e.S3_BUCKET, {
    message: "S3_BUCKET is required when FILE_STORE=s3",
    path: ["S3_BUCKET"],
  })
  .refine((e) => e.EMAIL_TRANSPORT !== "postmark" || !!e.POSTMARK_SERVER_TOKEN, {
    message: "POSTMARK_SERVER_TOKEN is required when EMAIL_TRANSPORT=postmark",
    path: ["POSTMARK_SERVER_TOKEN"],
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated environment, read lazily so builds don't need a full .env. */
export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
