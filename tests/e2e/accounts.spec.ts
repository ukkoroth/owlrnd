import { expect, test } from "@playwright/test";
import { closeDb, createFamily, createInvitation, deleteParentByEmail, uid } from "../fixtures";
import { inboxCount, nextCode } from "../mailpit";
import { enterCode, formAlert, signIn, signOut } from "./helpers";

test.afterAll(closeDb);

test("M1 done-when: a parent signs up, verifies, signs out and signs back in with a code", async ({ page }) => {
  const email = `atticus-${uid()}@test.owlrnd`;
  try {
    // Signed out, "/" is the landing page. Closed beta: sign-up opens from an invitation link.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Exam-ready/ })).toBeVisible();
    await page.goto(await createInvitation(email));

    await page.getByLabel("Your name").fill("Atticus Finch");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("parentpass1");
    const before = await inboxCount(email);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/sign-up\/verify$/);
    await expect(page.getByText(email)).toBeVisible();
    await enterCode(page, await nextCode(email, before));
    await page.getByRole("button", { name: "Verify email" }).click();

    // Flow 1: a new parent goes straight to 2a Add a student.
    await expect(page).toHaveURL(/\/students\/new$/);
    await expect(page.getByRole("heading", { name: "Set up the student account" })).toBeVisible();
    await page.getByRole("link", { name: "Back to your students" }).click();
    await expect(page.getByRole("heading", { name: "Your students" })).toBeVisible();
    await signOut(page, "Atticus Finch");

    const code = await signIn(page, email, "parentpass1", email);
    await expect(page.getByText(/a•••@test\.owlrnd/)).toBeVisible();
    await enterCode(page, code);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/students$/);
  } finally {
    await deleteParentByEmail(email);
  }
});

test("wrong codes count down, then a new code is sent automatically (5f)", async ({ page }) => {
  const { parent } = await createFamily();
  try {
    const code = await signIn(page, parent.email, parent.password, parent.email);
    const wrong = code === "000000" ? "111111" : "000000";

    await enterCode(page, wrong);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toHaveText("That code is not right. Check the latest email and try again. 2 tries left.");
    await expect(page.getByLabel("Digit 6 of 6")).toHaveValue(wrong[5]!); // digits stay, so a typo can be fixed
    await enterCode(page, wrong);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toContainText("1 try left.");

    const before = await inboxCount(parent.email);
    await enterCode(page, wrong);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toContainText("We sent a new code");
    const fresh = await nextCode(parent.email, before);

    await enterCode(page, code); // the old code is now just a wrong guess
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toContainText("2 tries left.");

    await enterCode(page, fresh);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/students$/);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("Send a new code replaces the old one", async ({ page }) => {
  const { parent } = await createFamily();
  try {
    const first = await signIn(page, parent.email, parent.password, parent.email);
    const before = await inboxCount(parent.email);
    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("We sent a new code");
    const second = await nextCode(parent.email, before);
    if (first !== second) {
      await enterCode(page, first);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(formAlert(page)).toBeVisible();
    }
    await enterCode(page, second);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/students$/);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("a student signs in with the code sent to their parent and lands on Today", async ({ page }) => {
  const { parent, student } = await createFamily();
  try {
    const code = await signIn(page, student.username.toUpperCase(), student.password, parent.email);
    await expect(page.getByText("Ask your parent for the code")).toBeVisible();
    await enterCode(page, code);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole("heading", { name: "Hi Scout" })).toBeVisible();

    // Students can't open parent pages; their own profile is read-only.
    await page.goto("/parent/profile");
    await expect(page).toHaveURL(/\/today$/);
    await page.goto("/profile");
    await expect(page.getByText(student.username)).toBeVisible();
    await expect(page.getByText("Your parent manages your password.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Edit|Change/ })).toHaveCount(0);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("sign-in errors don't say which part was wrong", async ({ page }) => {
  const { parent, student } = await createFamily();
  try {
    for (const [id, pw] of [
      [student.username, "wrong-password"],
      [`nobody-${uid()}`, "whatever1"],
    ]) {
      await page.goto("/sign-in");
      await page.getByLabel("Username or email").fill(id!);
      await page.getByLabel("Password").fill(pw!);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(formAlert(page)).toHaveText("That username or email and password don't match.");
      await expect(page.getByLabel("Username or email")).toHaveValue(id!);
    }
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("forgot password: a student resets with a code sent to the parent", async ({ page }) => {
  const { parent, student } = await createFamily();
  try {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/); // sign-in has a field with the same label
    await page.getByLabel("Username or email").fill(`nobody-${uid()}`);
    await page.getByRole("button", { name: "Send reset code" }).click();
    await expect(formAlert(page)).toHaveText("We couldn't find that username or email.");

    const before = await inboxCount(parent.email);
    await page.getByLabel("Username or email").fill(student.username);
    await page.getByRole("button", { name: "Send reset code" }).click();
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByText("Students: ask your parent for the code.")).toBeVisible();
    const code = await nextCode(parent.email, before);

    await enterCode(page, code);
    await page.getByLabel("New password").fill("newpassword");
    await page.getByLabel("Type it again").fill("different1");
    await page.getByRole("button", { name: "Save and sign in" }).click();
    await expect(page.getByText("The two passwords don't match.")).toBeVisible();

    await enterCode(page, code); // the mismatch didn't use up the code
    await page.getByLabel("New password").fill("newpassword");
    await page.getByLabel("Type it again").fill("newpassword");
    await page.getByRole("button", { name: "Save and sign in" }).click();
    await expect(page).toHaveURL(/\/today$/);

    await signOut(page, student.name);
    const signInCode = await signIn(page, student.username, "newpassword", parent.email);
    expect(signInCode).toMatch(/^\d{6}$/);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("a parent changes their email with a code sent to the new address", async ({ page }) => {
  const { parent } = await createFamily();
  const newEmail = `new-${uid()}@test.owlrnd`;
  try {
    await enterCode(page, await signIn(page, parent.email, parent.password, parent.email));
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/students$/);

    await page.getByRole("button", { name: `Account menu for ${parent.name}` }).click();
    await page.getByRole("link", { name: "Profile" }).click();
    await page.getByRole("link", { name: "Change email" }).click();
    await page.getByLabel("New email").fill(newEmail);
    const before = await inboxCount(newEmail);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page).toHaveURL(/\/parent\/profile\/email\/verify$/);
    await enterCode(page, await nextCode(newEmail, before));
    await page.getByRole("button", { name: "Confirm email" }).click();

    await expect(page).toHaveURL(/\/parent\/profile\?updated=email$/);
    await expect(page.getByText(newEmail)).toBeVisible();

    await signOut(page, parent.name);
    await signIn(page, newEmail, parent.password, newEmail); // sign-in codes now go to the new address
  } finally {
    await deleteParentByEmail(newEmail);
    await deleteParentByEmail(parent.email);
  }
});

test("a parent deletes their account", async ({ page }) => {
  const { parent, student } = await createFamily();
  await enterCode(page, await signIn(page, parent.email, parent.password, parent.email));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/students$/);
  await page.goto("/parent/profile");
  await page.getByRole("link", { name: "Delete my account" }).click();
  await expect(page.getByText("and your student")).toBeVisible();
  await page.getByLabel("Your password").fill(parent.password);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/sign-in\?deleted=1$/);
  await expect(page.getByText("Your account has been deleted.")).toBeVisible();

  // The student account went with it.
  await page.getByLabel("Username or email").fill(student.username);
  await page.getByLabel("Password").fill(student.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(formAlert(page)).toHaveText("That username or email and password don't match.");
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  for (const path of ["/students", "/today", "/profile", "/parent/profile", "/sign-in/code"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in/);
  }
});
