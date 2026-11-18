import { expect, test, type Page } from "@playwright/test";
import { closeDb, createFamily, createSelfLearner, deleteParentByEmail, deleteSelfLearner } from "../fixtures";
import { signInFully } from "./helpers";

// "Try a sample track" (owner, 2026-11-18): The Solar System, written in advance, ready at once, no AI.
test.afterAll(closeDb);

/** Answers every question (Option A, or "Mars") and submits. */
async function answerAll(page: Page) {
  await expect(page.locator('[data-question="0"]')).toBeVisible();
  for (;;) {
    for (const i of await page.locator("[data-question]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-question"))))) {
      const q = page.locator(`[data-question="${i}"]`);
      if (await q.getByRole("radio").count()) await q.locator("label", { hasText: "Option A:" }).click();
      else await q.getByRole("textbox").fill("Mars");
    }
    const next = page.getByRole("button", { name: "Next page" });
    if (!(await next.isVisible())) break;
    await next.click();
  }
  await page.getByRole("button", { name: "Submit exam" }).click();
  await expect(page).toHaveURL(/\/result$/, { timeout: 20_000 });
}

test("a new self-managed learner tries the sample track, sits its first exam at once and sees the result", async ({ page }) => {
  const { studentId, learner } = await createSelfLearner({ name: "Farhan" });
  try {
    await signInFully(page, learner.email, learner.password, learner.email, /\/(today|tracks\/setup)$/);
    await page.goto("/tracks/setup");
    await page.getByRole("button", { name: "Try a sample track" }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole("heading", { name: "Welcome, Farhan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The Solar System" })).toBeVisible();
    await page.getByRole("link", { name: /Start exam 1: The Solar System/ }).click();
    await expect(page.getByRole("heading", { name: /The Solar System/ })).toBeVisible();
    await answerAll(page);

    // On Your tracks it's marked Sample and takes no material.
    await page.goto("/tracks");
    const card = page.getByRole("article", { name: "The Solar System" });
    await expect(card.getByText("Sample", { exact: true })).toBeVisible();
    await expect(card.getByRole("link", { name: /Add material/ })).toHaveCount(0);
  } finally {
    await deleteSelfLearner(studentId);
  }
});

test("a parent adds the sample track for their child from the empty tracks page", async ({ page }) => {
  const { parent, studentId } = await createFamily({ studentName: "Jem" });
  try {
    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.goto(`/students/${studentId}/tracks`);
    await expect(page.getByText("Or try a sample track: The Solar System")).toBeVisible();
    await page.getByRole("button", { name: "Try a sample track" }).click();
    await expect(page).toHaveURL(new RegExp(`/students/${studentId}/tracks\\?created=1$`));
    const card = page.getByRole("article", { name: "The Solar System" });
    await expect(card).toContainText("first exam is ready");
  } finally {
    await deleteParentByEmail(parent.email);
  }
});
