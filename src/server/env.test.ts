import { afterEach, describe, expect, it, vi } from "vitest";

// env() caches its result, so each case loads a fresh copy of the module.
async function load(over: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(over)) vi.stubEnv(k, v as string);
  return (await import("./env")).env;
}
afterEach(() => vi.unstubAllEnvs());

const base = { DATABASE_URL: "postgres://u:p@localhost:5432/db", AUTH_SECRET: "x".repeat(32) };
const prod = {
  ...base,
  DEPLOY_ENV: "production",
  EMAIL_TRANSPORT: "smtp",
  FILE_STORE: "s3",
  S3_BUCKET: "uploads",
  APP_URL: "https://owlrnd.com",
  ANTHROPIC_API_KEY: "sk-test",
  OWLRND_FAKE_AI: "",
};

describe("settings checked at start-up", () => {
  it("development needs only the database and the auth secret", async () => {
    const env = await load({ ...base, DEPLOY_ENV: "development", FILE_STORE: "local", EMAIL_TRANSPORT: "console" });
    expect(env()).toMatchObject({ FILE_STORE: "local", JOB_CONCURRENCY: 6 });
  });

  it("production accepts a complete set of settings", async () => {
    const env = await load(prod);
    expect(env().DEPLOY_ENV).toBe("production");
  });

  it("production refuses development settings and names each one", async () => {
    const env = await load({ ...prod, EMAIL_TRANSPORT: "console", FILE_STORE: "local", APP_URL: "http://owlrnd.com", ANTHROPIC_API_KEY: "", OWLRND_FAKE_AI: "1" });
    let message = "";
    try {
      env();
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/^owlrnd cannot start/);
    for (const name of ["EMAIL_TRANSPORT", "FILE_STORE", "APP_URL", "ANTHROPIC_API_KEY", "OWLRND_FAKE_AI"]) expect(message).toContain(`- ${name}:`);
  });

  it("s3 storage needs a bucket name", async () => {
    const env = await load({ ...base, FILE_STORE: "s3", S3_BUCKET: "" });
    expect(() => env()).toThrow(/S3_BUCKET/);
  });
});
