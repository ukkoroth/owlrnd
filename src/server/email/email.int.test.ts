import { beforeAll, describe, expect, it } from "vitest";
import { clearInbox, latestCode } from "../../../tests/mailpit";
import { emailSender } from ".";

// Sends through Mailpit (npm run db:up starts it) and reads the code back from its API.
describe("email via Mailpit", () => {
  beforeAll(async () => {
    process.env.EMAIL_TRANSPORT = "smtp";
    await clearInbox();
  });

  it("delivers a sign-in code that a test can read back", async () => {
    const sentAt = new Date(Date.now() - 1000);
    await emailSender().sendCode({
      to: "parent@example.com",
      parentName: "Atticus",
      purpose: "sign_in",
      code: "482913",
      studentName: "Scout",
      ttlMinutes: 10,
    });
    expect(await latestCode("parent@example.com", { after: sentAt })).toBe("482913");
  });
});
