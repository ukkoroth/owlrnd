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
    /** Background jobs run at once per server process (writing and marking exams mostly wait on Claude). */
    /** Set to "production" on the live server only: turns on the production checks below. */
    DEPLOY_ENV: z.enum(["development", "production"]).default("development"),
    ANTHROPIC_API_KEY: z.string().optional(),
    OWLRND_FAKE_AI: z.string().optional(),
    /** Claude spend allowed per calendar month (UTC), in US dollars. At it, new chats and exam writing pause. */
    AI_MONTHLY_BUDGET_USD: z.coerce.number().positive().default(150),
    JOB_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(6),
    /** Public address of the app, used in links inside emails (invitations). No trailing slash. */
    APP_URL: z.string().url().default("http://localhost:3000"),
    /** Where new access requests are announced. Optional: without it, requests are only recorded. */
    OWNER_EMAIL: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  })
  .superRefine((e, ctx) => {
    if (e.DEPLOY_ENV !== "production") return;
    const need = (ok: boolean, path: string, message: string) => ok || ctx.addIssue({ code: "custom", path: [path], message });
    need(e.EMAIL_TRANSPORT !== "console", "EMAIL_TRANSPORT", "must send real email in production (smtp or postmark), not console");
    need(e.FILE_STORE === "s3", "FILE_STORE", "must be s3 in production");
    need(e.APP_URL.startsWith("https://"), "APP_URL", "must be an https:// address in production");
    need(!!e.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY", "is required in production");
    need(e.OWLRND_FAKE_AI !== "1", "OWLRND_FAKE_AI", "must not be on in production");
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
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "settings"}: ${i.message}`);
      throw new Error(`owlrnd cannot start: fix these settings in the environment file.\n${lines.join("\n")}`);
    }
    cached = parsed.data;
  }
  return cached;
}
