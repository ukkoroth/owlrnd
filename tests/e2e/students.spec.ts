import { expect, test, type Page } from "@playwright/test";
import { closeDb, createFamily, createInvitation, deleteParentByEmail, uid } from "../fixtures";
import { inboxCount, nextCode } from "../mailpit";
import { enterCode, formAlert, formNotice, signIn, signInFully, signOut } from "./helpers";

test.afterAll(closeDb);

async function fillStudent(page: Page, s: { name: string; className: string; username: string; password: string }) {
  await page.getByLabel("Student's name").fill(s.name);
  await page.getByLabel("Class").fill(s.className);
  await page.getByLabel("Username").fill(s.username);
  await page.getByLabel("Password").fill(s.password);
  await page.getByRole("button", { name: "Create student account" }).click();
}

test("M2 done-when: a parent adds two students and each signs in with the parent's code", async ({ page, browser }) => {
  const email = `family-${uid()}@test.owlrnd`;
  const scout = { name: "Scout", className: "10", username: `scout.${uid()}`, password: "practice1" };
  const jem = { name: "Jem", className: "Class 8", username: `jem.${uid()}`, password: "practice2" };
  try {
    // Sign up and verify → 2a
    await page.goto(await createInvitation(email));
    await page.getByLabel("Your name").fill("Atticus Finch");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("parentpass1");
    const before = await inboxCount(email);
    await page.getByRole("button", { name: "Create account" }).click();
    await enterCode(page, await nextCode(email, before));
    await page.getByRole("button", { name: "Verify email" }).click();
    await expect(page).toHaveURL(/\/students\/new$/);
    await expect(page.getByText("Now add your child.")).toBeVisible();

    // 2a → 2b
    await fillStudent(page, scout);
    await expect(page.getByRole("heading", { name: "Student added" })).toBeVisible();
    await expect(page.getByText("Scout is all set.")).toBeVisible();
    const details = page.getByRole("main").locator("dl");
    await expect(details).toContainText("Class 10");
    await expect(details).toContainText(scout.username);
    await expect(details).toContainText(scout.password);
    await expect(page.getByText(`a 6-digit code is sent to your email, ${email}`)).toBeVisible();

    // Add another → blank 2a → 2b → Go to your students
    await page.getByRole("button", { name: "Add another student" }).click();
    await expect(page.getByLabel("Student's name")).toHaveValue("");
    await fillStudent(page, jem);
    await expect(page.getByText("Jem is all set.")).toBeVisible();
    await page.getByRole("link", { name: "Go to your students" }).click();

    await expect(page).toHaveURL(/\/students$/);
    const cards = page.getByRole("main").getByRole("listitem");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText(`Class 10 · username ${scout.username}`);
    await expect(cards.nth(1)).toContainText(`Class 8 · username ${jem.username}`);

    // Each student signs in with their own username and a code from the parent's inbox.
    for (const kid of [scout, jem]) {
      const ctx = await browser.newContext();
      const kidPage = await ctx.newPage();
      await signInFully(kidPage, kid.username, kid.password, email, /\/today$/);
      await expect(kidPage.getByRole("heading", { name: `Hi ${kid.name}` })).toBeVisible();
      await ctx.close();
    }
  } finally {
    await deleteParentByEmail(email);
  }
});

test("a taken username shows a friendly error and keeps what was typed", async ({ page }) => {
  const { parent, student } = await createFamily();
  try {
    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.getByRole("link", { name: "Add student" }).click();
    await fillStudent(page, { name: "Twin", className: "10", username: student.username.toUpperCase(), password: "practice1" });
    await expect(page.getByText("That username is taken.")).toBeVisible();
    await expect(page.getByLabel("Student's name")).toHaveValue("Twin");
    await expect(page.getByLabel("Password")).toHaveValue("practice1");
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("editing a student's details changes how they sign in", async ({ page, browser }) => {
  const { parent, student } = await createFamily();
  const newUsername = `scout.new.${uid()}`;
  try {
    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.getByRole("link", { name: `Edit ${student.name}` }).click();
    await expect(page.getByRole("heading", { name: `Edit ${student.name}` })).toBeVisible();
    await page.getByLabel("Student's name").fill("Scout F");
    await page.getByLabel("Username").fill(newUsername);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(formNotice(page).first()).toHaveText("Changes saved.");

    await page.goto("/students");
    await expect(page.getByRole("main")).toContainText(`username ${newUsername}`);

    const ctx = await browser.newContext();
    const kid = await ctx.newPage();
    await signInFully(kid, newUsername, student.password, parent.email, /\/today$/);
    await expect(kid.getByRole("heading", { name: "Hi Scout F" })).toBeVisible();
    await ctx.close();
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("a new password signs the student out, and only the new password works", async ({ page, browser }) => {
  const { parent, student } = await createFamily();
  try {
    // The student is signed in on their own device.
    const kidCtx = await browser.newContext();
    const kid = await kidCtx.newPage();
    await signInFully(kid, student.username, student.password, parent.email, /\/today$/);

    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.getByRole("link", { name: `Edit ${student.name}` }).click();
    await page.getByLabel(`New password for ${student.name}`).fill("brandnew1");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(formNotice(page)).toContainText(`${student.name} has been signed out`);

    await kid.reload();
    await expect(kid).toHaveURL(/\/sign-in$/);

    await kid.getByLabel("Username or email").fill(student.username);
    await kid.getByLabel("Password").fill(student.password);
    await kid.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(kid)).toHaveText("That username or email and password don't match.");
    await signIn(kid, student.username, "brandnew1", parent.email);
    await kidCtx.close();
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("removing a student asks first, then deletes the account", async ({ page }) => {
  const { parent, student } = await createFamily();
  try {
    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.getByRole("link", { name: `Edit ${student.name}` }).click();

    await page.getByRole("button", { name: `Remove ${student.name}` }).click();
    await expect(page.getByText(`Remove ${student.name} for good? This cannot be undone.`)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("for good?")).toHaveCount(0);

    await page.getByRole("button", { name: `Remove ${student.name}` }).click();
    await page.getByRole("button", { name: `Yes, remove ${student.name}` }).click();
    await expect(page).toHaveURL(/\/students\?removed=/);
    await expect(formNotice(page)).toHaveText(`${student.name}'s account has been removed.`);
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(0);

    await signOut(page, parent.name);
    await page.getByLabel("Username or email").fill(student.username);
    await page.getByLabel("Password").fill(student.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toHaveText("That username or email and password don't match.");
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("parents only see their own students; students can't open parent pages", async ({ page, browser }) => {
  const a = await createFamily();
  const b = await createFamily();
  try {
    await signInFully(page, a.parent.email, a.parent.password, a.parent.email, /\/students$/);
    for (const path of [`/students/${b.studentId}/edit`, `/students/${b.studentId}/setup`, `/students/${b.studentId}/tracks`]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(404);
    }
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(0); // 404 page, not b's student

    const ctx = await browser.newContext();
    const kid = await ctx.newPage();
    await signInFully(kid, a.student.username, a.student.password, a.parent.email, /\/today$/);
    for (const path of ["/students", "/students/new", `/students/${a.studentId}/edit`]) {
      await kid.goto(path);
      await expect(kid).toHaveURL(/\/today$/);
    }
    await ctx.close();
  } finally {
    await deleteParentByEmail(a.parent.email);
    await deleteParentByEmail(b.parent.email);
  }
});

test("2c set-up choice: from scratch is active, packages are coming soon", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.goto(`/students/${studentId}/setup`);
    await expect(page.getByRole("heading", { name: `How would you like to set up ${student.name}'s practice?` })).toBeVisible();
    await expect(page.getByRole("button", { name: "Coming soon" })).toBeDisabled();
    await page.getByRole("link", { name: "Start setting up" }).click();
    await expect(page).toHaveURL(new RegExp(`/students/${studentId}/tracks$`));
  } finally {
    await deleteParentByEmail(parent.email);
  }
});
