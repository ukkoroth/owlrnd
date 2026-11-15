import { expect, test } from "@playwright/test";
import { accessRequestFor, closeDb, createInvitation, deleteParentByEmail, uid } from "../fixtures";
import { inboxCount, nextCode } from "../mailpit";
import { enterCode, formAlert } from "./helpers";

// Closed beta (release plan, Phase 1 item 1): Get access → owner invites → sign-up only through the link.
test.afterAll(closeDb);

test("a visitor asks for access from the landing page and the request is recorded", async ({ page }) => {
  const email = `beta-${uid()}@test.owlrnd`;
  try {
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: "Get access" }).first().click();
    await expect(page).toHaveURL(/\/get-access$/);
    await page.getByLabel("Your name").fill("Asha Menon");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/class and what they/).fill("Class 9, maths");
    await page.getByRole("button", { name: "Get access" }).click();

    await expect(page).toHaveURL(/\/get-access\?sent=1$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thanks, we've got your request.");
    expect(await accessRequestFor(email)).toEqual({ name: "Asha Menon", note: "Class 9, maths", status: "pending" });
  } finally {
    await deleteParentByEmail(email);
  }
});

test("asking for access checks the name and email", async ({ page }) => {
  await page.goto("/get-access");
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Email").fill("not-an-email@x");
  await page.getByRole("button", { name: "Get access" }).click();
  await expect(page.locator("#f-email-err")).toBeVisible();
  await expect(page).toHaveURL(/\/get-access$/);
});

test("sign-up without an invitation says the beta is invite-only", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "owlrnd is invite-only for now" })).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await page.getByRole("main").getByRole("link", { name: "Get access" }).click();
  await expect(page).toHaveURL(/\/get-access$/);

  await page.goto("/sign-up?invite=made-up-token");
  await expect(page.getByRole("heading", { name: "This invitation link has expired" })).toBeVisible();
});

test("sign-in points new visitors to Get access", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("link", { name: "Get access" }).first()).toHaveAttribute("href", "/get-access");
});

test("an invitation link signs up once; afterwards it no longer works", async ({ page, browser }) => {
  const email = `invited-${uid()}@test.owlrnd`;
  try {
    const link = await createInvitation(email);
    await page.goto(link);
    await expect(page.getByLabel("Email")).toHaveValue(email); // prefilled from the invitation
    await page.getByLabel("Your name").fill("Asha Menon");
    await page.getByLabel("Password").fill("parentpass1");
    const before = await inboxCount(email);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/sign-up\/verify$/);
    await enterCode(page, await nextCode(email, before));
    await page.getByRole("button", { name: "Verify email" }).click();
    await expect(page).toHaveURL(/\/students\/new$/);

    const other = await browser.newPage();
    await other.goto(link);
    await expect(other.getByRole("heading", { name: "This invitation link has expired" })).toBeVisible();
    await other.close();
  } finally {
    await deleteParentByEmail(email);
  }
});

test("an expired invitation link is refused", async ({ page }) => {
  const email = `expired-${uid()}@test.owlrnd`;
  try {
    await page.goto(await createInvitation(email, { expiresInDays: -1 }));
    await expect(page.getByRole("heading", { name: "This invitation link has expired" })).toBeVisible();
    await expect(formAlert(page)).toHaveCount(0);
  } finally {
    await deleteParentByEmail(email);
  }
});
