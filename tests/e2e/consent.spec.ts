import { expect, test, type Page } from "@playwright/test";
import { ageConsentRequests, closeDb, createSelfLearner, createTrackWithExam, deleteLearnerByEmail, deleteSelfLearner, uid } from "../fixtures";
import { inboxCount, latestLink, nextCode } from "../mailpit";
import { enterCode, signInFully } from "./helpers";

// M10 (editions §2.4): an under-18 learner practises straight away; a parent agrees or declines from the email.
test.afterAll(closeDb);

const teenDob = `${new Date().getFullYear() - 15}-01-01`;
const banner = (page: Page) => page.getByRole("status").filter({ hasText: /parent/ });

async function askParent(page: Page, parentEmail: string) {
  await page.getByLabel("Parent or guardian's name").fill("Shyamaldas");
  await page.getByLabel("Their email").fill(parentEmail);
  await page.getByRole("button", { name: "Send and continue" }).click();
}

/** The parent opens the link from their email; opening it sends them a code. */
async function parentOpens(parent: Page, parentEmail: string) {
  const link = await latestLink(parentEmail, /https?:\/\/\S+\/consent\/\S+/);
  const before = await inboxCount(parentEmail);
  await parent.goto(new URL(link).pathname);
  await expect(parent.getByRole("heading", { name: "Do you agree?" })).toBeVisible();
  return nextCode(parentEmail, before);
}

test("M10 done-when: a 15-year-old signs up, practises straight away, and the parent agrees", async ({ page, browser }) => {
  const email = `teen-${uid()}@test.owlrnd`;
  const parentEmail = `parent-${uid()}@test.owlrnd`;
  try {
    await page.goto("/sign-up?for=me");
    await page.getByLabel("Your name").fill("Rancho");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("learnerpass1");
    await page.getByLabel("Day").fill("1");
    await page.getByLabel("Month").selectOption({ label: "January" });
    await page.getByLabel("Year").fill(teenDob.slice(0, 4));
    await page.getByLabel(/I agree to the/).check();
    const before = await inboxCount(email);
    await page.getByRole("button", { name: "Create account" }).click();
    await enterCode(page, await nextCode(email, before));
    await page.getByRole("button", { name: "Verify email" }).click();

    // sm-1d → sm-2a, with the sm-1e banner.
    await expect(page).toHaveURL(/\/consent\/parent$/);
    await expect(page.getByRole("heading", { name: "Ask a parent to agree" })).toBeVisible();
    await askParent(page, email); // the learner's own email is refused
    await expect(page.locator("#f-parentEmail-err")).toHaveText("Use your parent's email, not your own.");
    await askParent(page, parentEmail);
    await expect(page).toHaveURL(/\/tracks\/setup$/);
    await expect(banner(page)).toContainText("Waiting for your parent to agree.");
    await expect(banner(page)).toContainText("You can keep practising meanwhile.");

    // The parent: link from the email → code from the email → agree.
    const parentCtx = await browser.newContext();
    const parent = await parentCtx.newPage();
    const code = await parentOpens(parent, parentEmail);
    await expect(parent.getByText(/Rancho is practising on owlrnd\./)).toBeVisible();
    await enterCode(parent, code);
    await parent.getByRole("button", { name: "I agree" }).click();
    await expect(parent.locator("#f-consent-err")).toBeVisible(); // the box must be ticked
    await parent.getByLabel(/I am Rancho's parent or lawful guardian/).check();
    await parent.getByRole("button", { name: "I agree" }).click();
    await expect(parent).toHaveURL(/\/consent\/done\?answer=agreed$/);
    await expect(parent.getByRole("heading", { name: "Thank you, you've agreed" })).toBeVisible();
    await parentCtx.close();

    await page.goto("/today");
    await expect(banner(page)).toHaveCount(0);
  } finally {
    await deleteLearnerByEmail(email);
  }
});

test("the parent declines: the learner's account is closed and the link stops working", async ({ page, browser }) => {
  const { learner } = await createSelfLearner({ name: "Rancho", dateOfBirth: teenDob });
  const parentEmail = `parent-${uid()}@test.owlrnd`;
  try {
    await signInFully(page, learner.email, learner.password, learner.email, /\/today$/);
    await expect(banner(page)).toContainText("Ask a parent to agree.");
    await page.getByRole("link", { name: "Ask a parent" }).click();
    await askParent(page, parentEmail);
    await expect(page).toHaveURL(/\/tracks\/setup$/);

    const parentCtx = await browser.newContext();
    const parent = await parentCtx.newPage();
    const code = await parentOpens(parent, parentEmail);
    const consentPath = new URL(parent.url()).pathname;
    await enterCode(parent, code);
    await parent.getByRole("button", { name: "Decline" }).click();
    await expect(parent.getByRole("heading", { name: "You've declined" })).toBeVisible();
    await parent.goto(consentPath);
    await expect(parent.getByRole("heading", { name: "This link has expired" })).toBeVisible();
    await parentCtx.close();

    await page.goto("/today");
    await expect(page).toHaveURL(/\/sign-in/);
  } finally {
    await deleteLearnerByEmail(learner.email);
  }
});

test("Resend and Change email from the banner; an unknown link shows the expired page", async ({ page }) => {
  const { studentId, learner } = await createSelfLearner({ name: "Rancho", dateOfBirth: teenDob });
  const first = `parent-${uid()}@test.owlrnd`;
  const second = `parent-${uid()}@test.owlrnd`;
  try {
    await signInFully(page, learner.email, learner.password, learner.email, /\/today$/);
    await page.goto("/consent/parent");
    await askParent(page, first);
    await expect(page).toHaveURL(/\/tracks\/setup$/);
    const firstLink = await latestLink(first, /https?:\/\/\S+\/consent\/\S+/);

    await page.goto("/today");
    const before = await inboxCount(first);
    await banner(page).getByRole("button", { name: "Resend" }).click();
    await expect.poll(() => inboxCount(first)).toBeGreaterThan(before);
    const newLink = await latestLink(first, /https?:\/\/\S+\/consent\/\S+/);
    expect(newLink).not.toBe(firstLink);
    await page.goto(new URL(firstLink).pathname);
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();

    await page.goto("/today");
    await banner(page).getByRole("link", { name: "Change email" }).click();
    await expect(page.getByLabel("Their email")).toHaveValue(first);
    await askParent(page, second);
    await expect(banner(page)).toContainText(/We emailed p•••@test\.owlrnd/);

    await page.goto("/consent/not-a-real-token");
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  } finally {
    await deleteSelfLearner(studentId);
  }
});

test("no answer after 30 days: practice pauses and exams can't be opened", async ({ page }) => {
  const { studentId, learner } = await createSelfLearner({ name: "Rancho", dateOfBirth: teenDob });
  try {
    const { examId } = await createTrackWithExam(studentId, { name: "JEE Physics: Ray optics" });
    await signInFully(page, learner.email, learner.password, learner.email, /\/today$/);
    await page.goto("/consent/parent");
    await askParent(page, `parent-${uid()}@test.owlrnd`);
    await expect(page).toHaveURL(/\/tracks\/setup$/);
    await ageConsentRequests(studentId, 31);

    await page.goto("/today");
    await expect(banner(page)).toContainText("Practice is paused until your parent agrees.");
    await page.goto(`/exam/${examId}`);
    await expect(page).toHaveURL(/\/today$/);
  } finally {
    await deleteSelfLearner(studentId);
  }
});
