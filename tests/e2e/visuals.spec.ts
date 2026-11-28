import { expect, test, type Page } from "@playwright/test";
import { sampleVisuals } from "../../src/content/visuals/samples";
import { closeDb, createFamily, createTrackWithExam, deleteParentByEmail, type FixtureQuestion } from "../fixtures";
import { signInFully } from "./helpers";

test.afterAll(closeDb);

// Pictures under wrong answers (docs/plan-wrong-answer-visuals.md): six questions with pictures, four without.
const paper: FixtureQuestion[] = [
  ...sampleVisuals.slice(0, 6).map((v): FixtureQuestion => ({ type: "multiple_choice", prompt: v.prompt, options: [v.answer, "wrong one", "wrong two", "wrong three"], correct: 0, explanation: "See the picture.", visual: v.scene })),
  ...Array.from({ length: 4 }, (_, i): FixtureQuestion => ({ type: "multiple_choice", prompt: `Name the effect ${i + 1}`, options: ["Dispersion", "wrong one", "wrong two", "wrong three"], correct: 0 })),
];

async function answerAll(page: Page, isRight: (i: number) => boolean) {
  await expect(page.locator('[data-question="0"]')).toBeVisible();
  for (;;) {
    for (const i of await page.locator("[data-question]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-question"))))) {
      await page.locator(`[data-question="${i}"]`).locator("label", { hasText: isRight(i) ? "Option A:" : "Option B:" }).click();
    }
    const next = page.getByRole("button", { name: "Next page" });
    if (!(await next.isVisible())) break;
    await next.click();
  }
}

test("a wrong answer shows its picture on the marked paper, a right one doesn't, and no page scrolls", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { name: "Physics: Light energy", questions: paper, topicNames: ["Reflection", "Refraction"] });
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await answerAll(page, (i) => i === 1); // question 2 right, the rest wrong
    await page.getByRole("button", { name: "Submit exam" }).click();
    await expect(page).toHaveURL(/\/result$/, { timeout: 20_000 });
    await page.getByRole("link", { name: "See marked paper" }).click();
    await expect(page).toHaveURL(/\/marked$/);

    const q1 = page.locator('[data-question="0"]');
    await expect(q1.getByRole("img", { name: sampleVisuals[0]!.scene.alt })).toBeVisible();
    await expect(q1.locator("figure ol > li")).toHaveCount(sampleVisuals[0]!.scene.steps.length);
    await expect(q1.getByRole("button", { name: "Replay" })).toBeVisible();
    await expect(page.locator('[data-question="1"]').getByRole("img")).toHaveCount(0); // answered right

    const seen = new Set<number>();
    for (const size of [{ width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await expect(page.locator("[data-paged-for]")).toHaveAttribute("data-paged-for", /\d+x\d+/);
      while (await page.getByRole("button", { name: "Previous page" }).isVisible()) await page.getByRole("button", { name: "Previous page" }).click();
      for (;;) {
        expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight), `${size.width}px`).toBe(true);
        for (const i of await page.locator("[data-question]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-question"))))) seen.add(i);
        const next = page.getByRole("button", { name: "Next page" });
        if (!(await next.isVisible())) break;
        await next.click();
      }
    }
    expect(seen.size).toBe(10);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});
