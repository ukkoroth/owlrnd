import { expect, test, type Page } from "@playwright/test";
import { closeDb, createFamily, createSelfLearner, createTrackWithExam, deleteParentByEmail, deleteSelfLearner, type FixtureQuestion } from "../fixtures";
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

async function practiseTen(page: Page) {
  await expect(page.getByText("Card 1 of 10")).toBeVisible({ timeout: 15_000 });
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByText(`Card ${i} of 10`)).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Got it" })).toBeVisible();
    await page.keyboard.press("2");
  }
  await expect(page.getByRole("heading", { name: "Session done" })).toBeVisible();
}

test("F3 done-when: Practise from the dashboard, points for the session, counts update; the deck page", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { name: "Physics: Current electricity", questions: paper, topicNames: ["Ohm's law", "Resistors"] });
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);

    // fc-1: no deck yet, so the button offers the top-up.
    await page.getByRole("link", { name: "Practise 10 new flashcards: Physics: Current electricity" }).click();
    await practiseTen(page);
    await expect(page.getByRole("definition").filter({ hasText: "+5" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Exams" }).click();
    await expect(page).toHaveURL(/\/today$/);

    // fc-5 (a child's tracks page): the deck line, then the deck (fc-6).
    await page.goto("/tracks");
    await expect(page.getByText("10 cards · none due today")).toBeVisible();
    await expect(page.getByText("Last: today")).toBeVisible();
    await page.getByRole("link", { name: "Flashcards in Physics: Current electricity" }).click();
    await expect(page.getByRole("heading", { name: "Flashcards" })).toBeVisible();
    await expect(page.getByText("10 cards · 0 to practise today · 0 known")).toBeVisible();
    await expect(page.getByText(/^Learning · /)).toHaveCount(10);

    // 4.3a: the points page lists the session.
    await page.goto("/points");
    await expect(page.getByText("Finished 1 flashcard session")).toBeVisible();
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("F3: a self-managed learner's track card has the deck line, Start, Practise and Flashcards", async ({ page }) => {
  const { studentId, learner } = await createSelfLearner({ name: "Rancho" });
  try {
    const { trackId } = await createTrackWithExam(studentId, { name: "JEE Physics: Current electricity", questions: paper, topicNames: ["Ohm's law"] });
    await signInFully(page, learner.email, learner.password, learner.email, /\/today$/);
    await page.goto("/tracks");
    const card = page.getByRole("article");
    await expect(card.getByText("Flashcards · being written")).toBeVisible();
    await expect(card.getByRole("link", { name: "Start exam 1 in JEE Physics: Current electricity" })).toBeVisible();
    await card.getByRole("link", { name: "Practise 10 new flashcards: JEE Physics: Current electricity" }).click();
    await practiseTen(page);
    await page.getByRole("link", { name: "Back to your tracks" }).click();
    await expect(page).toHaveURL(/\/tracks$/);
    await expect(card.getByRole("link", { name: "Flashcards in JEE Physics: Current electricity" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Practise \d+ (new )?flashcards/ })).toHaveAttribute("href", `/practise/${trackId}?from=tracks`);
  } finally {
    await deleteSelfLearner(studentId);
  }
});

test("F4 done-when: a parent sees a child's flashcard activity; it doesn't count as an exam", async ({ page, browser }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { name: "Physics: Current electricity", questions: paper, topicNames: ["Ohm's law", "Resistors"] });
    const kidCtx = await browser.newContext();
    const kid = await kidCtx.newPage();
    await signInFully(kid, student.username, student.password, parent.email, /\/today$/);
    await kid.getByRole("link", { name: /^Practise 10 new flashcards/ }).click();
    await practiseTen(kid);
    await kid.getByRole("link", { name: "Back to Exams" }).click();
    // Still the first-day dashboard: a flashcard session isn't an exam.
    await expect(kid.getByRole("heading", { name: `Welcome, ${student.name}` })).toBeVisible();
    await expect(kid.getByText(/exams? completed/)).toHaveCount(0);
    await kidCtx.close();

    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await expect(page.getByText("Flashcards: 1 session in the last 7 days · 0 cards known")).toBeVisible();
    await expect(page.getByText("0 exams · 1 flashcard session")).toBeVisible();
    await expect(page.getByText("No exams taken yet · 1 track.")).toBeVisible();
    await page.goto(`/students/${studentId}/tracks`);
    await expect(page.getByRole("article").getByText("1 session in the last 7 days · 0 of 10 cards known")).toBeVisible();
    // The parent doesn't practise: no Practise button, no card content.
    await expect(page.getByRole("link", { name: /^Practise/ })).toHaveCount(0);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});
