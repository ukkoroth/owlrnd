import { expect, test, type Page } from "@playwright/test";
import { closeDb, consentFor, deleteLearnerByEmail, deleteParentByEmail, learnerByEmail, uid } from "../fixtures";
import { inboxCount, nextCode } from "../mailpit";
import { enterCode, formAlert, signIn } from "./helpers";

// M8 (0.2): sign-up asks "Who is this account for?" (sm-1a); sign-up is open to everyone.
test.afterAll(closeDb);

async function fillForMe(page: Page, me: { name: string; email: string; password: string; dob: [string, string, string] }) {
  await page.getByLabel("Your name").fill(me.name);
  await page.getByLabel("Email").fill(me.email);
  await page.getByLabel("Password").fill(me.password);
  await page.getByLabel("Day").fill(me.dob[0]);
  await page.getByLabel("Month").selectOption({ label: me.dob[1] });
  await page.getByLabel("Year").fill(me.dob[2]);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
}

test("landing → Get started → Who is this account for?, with both choices", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole("heading", { name: "Who is this account for?" })).toBeVisible();
  await expect(page.getByRole("link", { name: /For me/ })).toHaveAttribute("href", "/sign-up?for=me");
  await expect(page.getByRole("link", { name: /For my child/ })).toHaveAttribute("href", "/sign-up?for=child");
  await expect(page.getByLabel("Password")).toHaveCount(0); // nothing is asked before the choice
});

test("M8 done-when, For me: sign up, verify at your own email, land in the learner shell; sign out and back in", async ({ page }) => {
  const me = { name: "Rancho", email: `rancho-${uid()}@test.owlrnd`, password: "learnerpass1", dob: ["12", "March", "2000"] as [string, string, string] };
  try {
    await page.goto("/sign-up");
    await page.getByRole("link", { name: /For me/ }).click();
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "← For me · change" })).toHaveAttribute("href", "/sign-up");

    const before = await inboxCount(me.email);
    await fillForMe(page, me);
    await expect(page).toHaveURL(/\/sign-up\/verify$/);
    await expect(page.getByText(me.email)).toBeVisible();
    await enterCode(page, await nextCode(me.email, before));
    await page.getByRole("button", { name: "Verify email" }).click();

    // M9: a new learner chooses their exam or builds a track first (sm-2a); the dashboard says what to do.
    await expect(page).toHaveURL(/\/tracks\/setup$/);
    await page.goto("/today");
    await expect(page.getByText("You set up what you practise.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Set up your first track" })).toHaveAttribute("href", "/tracks/setup");
    await expect(page.getByRole("button", { name: "Account menu for Rancho" })).toContainText("Learner");
    expect(await learnerByEmail(me.email)).toMatchObject({ type: "self_managed", dateOfBirth: "2000-03-12", consentVersion: expect.any(String) });

    // Shared computers (editions §2.7): nothing is pre-filled after signing out.
    await page.getByRole("button", { name: "Account menu for Rancho" }).click();
    await page.getByRole("complementary").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByLabel("Email or username")).toHaveValue("");

    // The code goes to the learner's own email (3b).
    const code = await signIn(page, me.email, me.password, me.email);
    await expect(page.getByText("A new 6-digit code was sent to your email")).toBeVisible();
    await expect(page.getByText(/parent/i)).toHaveCount(0);
    await enterCode(page, code);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/today$/);
  } finally {
    await deleteLearnerByEmail(me.email);
  }
});

test("For me under 13: no account is made, and a parent is suggested", async ({ page }) => {
  const email = `young-${uid()}@test.owlrnd`;
  try {
    await page.goto("/sign-up?for=me");
    const year = String(new Date().getFullYear() - 12);
    await fillForMe(page, { name: "Scout", email, password: "learnerpass1", dob: ["1", "June", year] });
    await expect(page.getByRole("heading", { name: "Ask a parent to help you sign up" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Set up with a parent" })).toHaveAttribute("href", "/sign-up?for=child");
    expect(await learnerByEmail(email)).toBeNull();
  } finally {
    await deleteLearnerByEmail(email);
  }
});

test("For me checks the date of birth and consent on the server", async ({ page }) => {
  const email = `checks-${uid()}@test.owlrnd`;
  try {
    await page.goto("/sign-up?for=me");
    await page.getByLabel(/I agree to the/).evaluate((el) => el.removeAttribute("required"));
    await page.getByLabel("Your name").fill("Rancho");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("learnerpass1");
    await page.getByLabel("Day").fill("31");
    await page.getByLabel("Month").selectOption({ label: "April" });
    await page.getByLabel("Year").fill("2000");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("#f-dob-err")).toHaveText("Enter a real date, for example 12 March 2009.");
    await expect(page.locator("#f-consent-err")).toBeVisible();
    await expect(page.getByLabel("Day")).toHaveValue("31"); // kept after the error
    expect(await learnerByEmail(email)).toBeNull();
  } finally {
    await deleteLearnerByEmail(email);
  }
});

test("For my child: the parent sign-up, with consent checked on the server and recorded", async ({ page }) => {
  const email = `consent-${uid()}@test.owlrnd`;
  try {
    await page.goto("/sign-up");
    await page.getByRole("link", { name: /For my child/ }).click();
    await expect(page.getByRole("heading", { name: "Create a parent account" })).toBeVisible();
    await page.getByLabel("Your name").fill("Atticus Finch");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("parentpass1");
    const box = page.getByLabel(/parent or legal guardian/);
    await expect(box).toHaveAttribute("required", "");

    // Bypass the browser's check: the server still refuses.
    await box.evaluate((el) => el.removeAttribute("required"));
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("#f-consent-err")).toContainText("parent or guardian");
    expect(await consentFor(email)).toBeNull();

    await page.getByLabel("Password").fill("parentpass1");
    await page.getByLabel(/parent or legal guardian/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/sign-up\/verify$/);
    expect((await consentFor(email))?.consentVersion).toBeTruthy();
  } finally {
    await deleteParentByEmail(email);
  }
});

test("one email, one account: For me refuses a parent's email", async ({ page, browser }) => {
  const email = `taken-${uid()}@test.owlrnd`;
  try {
    await page.goto("/sign-up?for=child");
    await page.getByLabel("Your name").fill("Atticus");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("parentpass1");
    await page.getByLabel(/parent or legal guardian/).check();
    const before = await inboxCount(email);
    await page.getByRole("button", { name: "Create account" }).click();
    await enterCode(page, await nextCode(email, before));
    await page.getByRole("button", { name: "Verify email" }).click();
    await expect(page).toHaveURL(/\/students\/new$/);
    await expect(page.getByRole("heading", { name: "Set up the student account" })).toBeVisible();

    // A fresh, signed-out browser. Clearing cookies wasn't enough: a request still in flight from the parent's page
    // could set the session cookie again, and sign-up then sent the "new" visitor to /students (flaky in CI).
    const fresh = await browser.newContext();
    const visitor = await fresh.newPage();
    await visitor.goto("/sign-up?for=me");
    await expect(visitor.getByLabel("Your name")).toBeVisible();
    await fillForMe(visitor, { name: "Atticus", email, password: "learnerpass1", dob: ["1", "January", "1980"] });
    await expect(visitor.locator("#f-email-err")).toHaveText("An account with this email already exists. Sign in instead.");
    await fresh.close();
  } finally {
    await deleteParentByEmail(email);
  }
});

test("the For parents section and footer lead to sign-up with For my child chosen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "For parents" })).toHaveCount(0); // never in the header
  await page.getByRole("link", { name: "Set up for my child" }).click();
  await expect(page).toHaveURL(/\/sign-up\?for=child$/);
  await expect(page.getByRole("heading", { name: "Create a parent account" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "For parents" })).toHaveAttribute("href", "#parents");
});

test("sign-up is open: Get access leads to sign-up, and sign-in offers Create an account", async ({ page }) => {
  await page.goto("/get-access");
  await expect(page).toHaveURL(/\/sign-up$/);
  await page.goto("/sign-in");
  await expect(page.getByRole("link", { name: "Create an account" }).first()).toHaveAttribute("href", "/sign-up");
  await expect(formAlert(page)).toHaveCount(0);
});
