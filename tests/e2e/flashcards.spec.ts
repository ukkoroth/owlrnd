import { expect, test, type Page } from "@playwright/test";
import { closeDb, createFamily, createTrackWithExam, deleteParentByEmail, type FixtureQuestion } from "../fixtures";
import { signInFully } from "./helpers";

test.afterAll(closeDb);

const paper: FixtureQuestion[] = [{ type: "multiple_choice", prompt: "MCQ on Ohm's law", options: ["right", "a", "b", "c"], correct: 0 }];

/** The page fits the window: nothing to scroll (rules §5, plan-0.3 F2). */
async function noScroll(page: Page) {
  const { sh, ih, sw, iw } = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
  expect(sh).toBeLessThanOrEqual(ih);
  expect(sw).toBeLessThanOrEqual(iw);
}

for (const size of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`F2 done-when (${size.name}): a learner practises 10 cards and sees the summary, without scrolling`, async ({ page }) => {
    await page.setViewportSize(size);
    const { parent, student, studentId } = await createFamily();
    try {
      const { trackId, examId } = await createTrackWithExam(studentId, { name: "Physics: Current electricity", questions: paper, topicNames: ["Ohm's law", "Resistors"] });
      await signInFully(page, student.username, student.password, parent.email, /\/today$/);
      await page.goto(`/practise/${trackId}`);

      await expect(page.getByText("Card 1 of 10")).toBeVisible({ timeout: 15_000 });
      await noScroll(page);
      for (let i = 1; i <= 10; i++) {
        await expect(page.getByText(`Card ${i} of 10`)).toBeVisible();
        if (i % 2) {
          // Mouse.
          await page.getByRole("button", { name: "Show answer" }).click();
          await expect(page.getByRole("region", { name: "Card, answer side" })).toBeVisible();
          await noScroll(page);
          await page.getByRole("button", { name: i === 1 ? "Not yet" : "Got it" }).click();
        } else {
          // Keyboard: Space, then 2 (Got it).
          await page.keyboard.press("Space");
          await expect(page.getByRole("button", { name: "Got it" })).toBeVisible();
          await page.keyboard.press("2");
        }
      }

      await expect(page.getByRole("heading", { name: "Session done" })).toBeVisible();
      await noScroll(page);
      await expect(page.getByText("To see again")).toBeVisible();
      await expect(page.getByRole("link", { name: "Practise these 1 again" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Start exam 1" })).toHaveAttribute("href", `/exam/${examId}`);

      // Again: just the "Not yet" card.
      await page.getByRole("link", { name: "Practise these 1 again" }).click();
      await expect(page.getByText("Card 1 of 1")).toBeVisible();
      await page.getByRole("link", { name: "Leave" }).click();
      await expect(page).toHaveURL(/\/today$/);
    } finally {
      await deleteParentByEmail(parent.email);
    }
  });
}
