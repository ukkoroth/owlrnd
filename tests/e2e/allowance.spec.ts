import { expect, test, type Page } from "@playwright/test";
import { addAiSpend, closeDb, createFamily, createSelfLearner, createTrackWithExam, deleteParentByEmail, deleteSelfLearner } from "../fixtures";
import { signInFully } from "./helpers";

// M7 (0.2 plan): the AI allowance tracker in the sidebar, and codes to the account holder.
test.afterAll(closeDb);

const shots = process.env.M7_SHOTS ? "tmp/screenshots/m7" : null;
const snap = async (page: Page, name: string) => {
  if (shots) await page.getByRole("complementary").screenshot({ path: `${shots}/${name}.png` });
};
const bar = (page: Page) => page.getByRole("progressbar", { name: "AI allowance" });

test("a parent sees their family's AI allowance; at 100% it links to Contact us to buy a package", async ({ page }) => {
  const fam = await createFamily();
  try {
    await signInFully(page, fam.parent.email, fam.parent.password, fam.parent.email, /\/students$/);
    await expect(bar(page)).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByText("$0 of $5 used")).toBeVisible();

    await addAiSpend({ parentId: fam.parentId }, 1.6);
    await page.reload();
    await expect(bar(page)).toHaveAttribute("aria-valuenow", "32");
    await expect(page.getByText("$1.60 of $5 used")).toBeVisible();
    await expect(page.getByRole("link", { name: "Contact us to buy a package" })).toHaveCount(0);
    await snap(page, "allowance-32");

    await addAiSpend({ parentId: fam.parentId }, 2.65);
    await page.reload();
    await expect(page.getByText("$4.25 of $5 used")).toBeVisible();
    await snap(page, "allowance-85");

    await addAiSpend({ parentId: fam.parentId }, 0.75);
    await page.reload();
    await expect(bar(page)).toHaveAttribute("aria-valuenow", "100");
    await snap(page, "allowance-100");
    // The banner links there too (see the used-up test below); this checks the sidebar's link.
    await page.getByRole("complementary").getByRole("link", { name: "Contact us to buy a package" }).click();
    await expect(page).toHaveURL(/\/contact\?topic=package$/);
    await expect(page.getByRole("heading", { name: "Buy a package" })).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveValue(fam.parent.name);
    await expect(page.getByLabel("Email")).toHaveValue(fam.parent.email);
  } finally {
    await deleteParentByEmail(fam.parent.email);
  }
});

test("a parent-managed learner doesn't see the allowance (it is their parent's)", async ({ page }) => {
  const fam = await createFamily();
  try {
    await signInFully(page, fam.student.username, fam.student.password, fam.parent.email, /\/today$/);
    await expect(page.getByText(/points/).first()).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
  } finally {
    await deleteParentByEmail(fam.parent.email);
  }
});

test("a self-managed learner signs in with a code sent to their own email and sees their own allowance", async ({ page }) => {
  const { studentId, learner } = await createSelfLearner();
  try {
    await signInFully(page, learner.email, learner.password, learner.email, /\/today$/);
    await expect(bar(page)).toHaveAttribute("aria-valuenow", "0");
  } finally {
    await deleteSelfLearner(studentId);
  }
});

const holdShots = process.env.HOLD_SHOTS ? "tmp/screenshots/allowance-hold" : null;

test("when the allowance is used up, the parent and the child are told, and the next exam shows as on hold", async ({ page }) => {
  const fam = await createFamily();
  try {
    await createTrackWithExam(fam.studentId, { name: "Maths: Factorisation", writing: true, hold: "allowance" });
    await addAiSpend({ parentId: fam.parentId }, 5.32);

    await signInFully(page, fam.parent.email, fam.parent.password, fam.parent.email, /\/students$/);
    await expect(page.getByText("Your AI allowance is used up.", { exact: true })).toBeVisible();
    await expect(page.getByText("First exam on hold: Maths: Factorisation")).toBeVisible();
    await expect(page.getByText(/On hold: your AI allowance is used up/)).toBeVisible();
    if (holdShots) await page.screenshot({ path: `${holdShots}/parent-students.png`, fullPage: true });
    await page.context().clearCookies();

    await signInFully(page, fam.student.username, fam.student.password, fam.parent.email, /\/today$/);
    await expect(page.getByText("New exams are on hold.", { exact: true })).toBeVisible();
    await expect(page.getByText(/your parent's AI allowance is used up/i).first()).toBeVisible();
    await expect(page.getByText("Exam being prepared")).toHaveCount(0);
    if (holdShots) await page.screenshot({ path: `${holdShots}/child-today.png`, fullPage: true });
  } finally {
    await deleteParentByEmail(fam.parent.email);
  }
});

test("no banner while there is allowance left", async ({ page }) => {
  const fam = await createFamily();
  try {
    await signInFully(page, fam.parent.email, fam.parent.password, fam.parent.email, /\/students$/);
    await expect(page.getByText("Your AI allowance is used up.", { exact: true })).toHaveCount(0);
  } finally {
    await deleteParentByEmail(fam.parent.email);
  }
});
