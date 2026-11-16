import { expect, test } from "@playwright/test";

// Public pages linked from the landing page footer.
test("footer links open the privacy, terms and contact pages", async ({ page }) => {
  for (const [link, heading] of [
    ["Privacy", "Privacy policy"],
    ["Terms", "Terms of use"],
    ["Contact", "Contact"],
  ] as const) {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("link", { name: "hello@owlrnd.com" }).first()).toHaveAttribute("href", /^mailto:hello@owlrnd\.com/);
  }
});

test("the privacy policy names the operator and the AI provider", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByText("owlrnd is run by Unni Koroth")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How the AI uses your material" })).toBeVisible();
});

test("the header links to the open-source repository on GitHub", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /open source: view the code on GitHub/ })).toHaveAttribute("href", "https://github.com/ukkoroth/owlrnd");
});

test("the landing page explains the open-source project and links to the code", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "Built in the open." })).toBeVisible();
  await expect(page.getByRole("link", { name: "View the code on GitHub", exact: true })).toHaveAttribute("href", "https://github.com/ukkoroth/owlrnd");
  await expect(page.getByLabel("Commands to run owlrnd yourself")).toContainText("git clone https://github.com/ukkoroth/owlrnd.git");
});

test("pages send security headers and nothing breaks under the Content-Security-Policy", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(m.text())) violations.push(m.text());
  });
  for (const path of ["/", "/sign-in", "/sign-up?for=me", "/privacy"]) {
    const res = await page.goto(path);
    const h = res!.headers();
    expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  }
  // A form that only works with JavaScript: the client-side code ran under the policy.
  await page.goto("/contact?topic=package");
  await page.getByLabel("Email").fill("not-an-email@x");
  await page.getByLabel("Your name").fill("Asha");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("#f-email-err")).toBeVisible();
  expect(violations).toEqual([]);
});

test("the package request form is limited per network address", async ({ browser }) => {
  // Requests carry a made-up proxy address, as Caddy adds in production.
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 250)}` } });
  const page = await ctx.newPage();
  for (let i = 0; i < 6; i++) {
    await page.goto("/contact?topic=package");
    await page.getByLabel("Your name").fill("Asha");
    await page.getByLabel("Email").fill("bad@x");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator("#f-email-err").or(page.getByRole("main").getByRole("alert"))).toBeVisible();
  }
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Too many attempts from your network");
  await ctx.close();
});
