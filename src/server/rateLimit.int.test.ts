import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { rules } from "@/config/rules";
import { lastForwardedIp } from "./auth/current";
import { hit } from "./rateLimit";

describe("rate limits per client IP", () => {
  it("allows up to the limit in a window, then refuses, and starts again in the next window", async () => {
    const ip = `198.51.100.${randomUUID().slice(0, 4)}`;
    const { max, windowMinutes } = rules.rateLimits.getAccess;
    const t0 = new Date("2030-01-01T10:00:00Z");
    for (let i = 0; i < max; i++) expect(await hit("getAccess", ip, t0)).toBe(true);
    expect(await hit("getAccess", ip, t0)).toBe(false);
    expect(await hit("getAccess", `${ip}-other`, t0)).toBe(true); // another address is unaffected
    expect(await hit("signUp", ip, t0)).toBe(true); // another action is unaffected
    expect(await hit("getAccess", ip, new Date(t0.getTime() + windowMinutes * 60_000))).toBe(true);
  });

  it("does not limit when there is no client address", async () => {
    for (let i = 0; i < rules.rateLimits.getAccess.max + 3; i++) expect(await hit("getAccess", null)).toBe(true);
  });
});

describe("client IP behind the proxy", () => {
  it("trusts only the last address, which the proxy added", () => {
    expect(lastForwardedIp("203.0.113.9")).toBe("203.0.113.9");
    expect(lastForwardedIp("1.2.3.4, 203.0.113.9")).toBe("203.0.113.9"); // a forged first entry is ignored
  });
  it("treats loopback and a missing header as no address", () => {
    expect(lastForwardedIp(null)).toBeNull();
    expect(lastForwardedIp("::1")).toBeNull();
    expect(lastForwardedIp("127.0.0.1")).toBeNull();
    expect(lastForwardedIp("::ffff:127.0.0.1")).toBeNull();
  });
});
