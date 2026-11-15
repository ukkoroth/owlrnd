import { expect, test, type Page } from "@playwright/test";
import { closeDb, createFamily, createTrackWithExam, deleteParentByEmail, type FixtureQuestion } from "../fixtures";
import { signInFully } from "./helpers";

test.afterAll(closeDb);

// Three topics; the student gets every "Resistors in parallel" question wrong.
const topics = ["Ohm's law", "Resistors in series", "Resistors in parallel"];
const paper: FixtureQuestion[] = Array.from({ length: 10 }, (_, i) =>
  i < 6
    ? { type: "multiple_choice", prompt: `MCQ ${i + 1} on ${topics[i % 3]}`, options: ["right", "wrong one", "wrong two", "wrong three"], correct: 0 }
    : { type: "short", prompt: `Short ${i + 1} on ${topics[i % 3]}`, expected: "Ohm's law" },
);
const topicOf = (i: number) => topics[i % 3]!;

async function answerAll(page: Page, isRight: (i: number) => boolean) {
  await expect(page.locator('[data-question="0"]')).toBeVisible();
  for (;;) {
    for (const i of await page.locator("[data-question]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-question"))))) {
      const q = page.locator(`[data-question="${i}"]`);
      if (await q.getByRole("radio").count()) await q.locator("label", { hasText: isRight(i) ? "Option A:" : "Option B:" }).click();
      else await q.getByRole("textbox").fill(isRight(i) ? "ohms law" : "no idea");
    }
    const next = page.getByRole("button", { name: "Next page" });
    if (!(await next.isVisible())) break;
    await next.click();
  }
}

test("M5 done-when: marking, result with points and needs work, marked paper, and an exam 2 that leans on the weak topic", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { questions: paper, topicNames: topics });
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await answerAll(page, (i) => topicOf(i) !== "Resistors in parallel");
    await page.getByRole("button", { name: "Submit exam" }).click();

    // 4.1d → 4.1e
    await expect(page).toHaveURL(/\/marking$|\/result$/);
    await expect(page).toHaveURL(/\/result$/, { timeout: 20_000 });
    const wrong = paper.filter((_, i) => topicOf(i) === "Resistors in parallel").length; // 3
    await expect(page.getByText(`${10 - wrong} / 10`)).toBeVisible();
    const pts = page.getByRole("region", { name: "Points earned" });
    await expect(pts).toContainText("Finished the exam");
    await expect(pts).toContainText(`${10 - wrong} correct answers, 2 points each`);
    await expect(pts).toContainText(`+${10 + 2 * (10 - wrong)}`);
    await expect(page.getByRole("region", { name: "Needs work" })).toContainText("Resistors in parallel");
    await expect(page.getByRole("region", { name: "Needs work" })).toContainText(`0 of ${wrong}`);
    await expect(page.getByText(/Exam 2 will have more questions on resistors in parallel/)).toBeVisible();
    // Sidebar total matches the points earned.
    await expect(page.getByRole("complementary")).toContainText(`${10 + 2 * (10 - wrong)}`);

    // 4.1f
    await page.getByRole("link", { name: "See marked paper" }).click();
    await expect(page).toHaveURL(/\/marked$/);
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight)).toBe(true);
    await expect(page.locator('[data-question="2"]')).toContainText("Wrong.");
    await expect(page.locator('[data-question="2"]')).toContainText("Why:");
    await expect(page.locator('[data-question="0"]')).toContainText("Correct.");
    await expect(page.locator('[data-question="0"]')).toContainText("Correct answer: right");

    // Exam 2 is written in the background and leans on the weak topic.
    await expect(async () => {
      await page.goto("/today");
      await expect(page.getByRole("link", { name: /Start exam 2/ })).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("link", { name: /Start exam 2/ }).click();
    await expect(page.locator('[data-question="0"]')).toBeVisible();
    const prompts = await page.locator("[data-question]").allInnerTexts();
    // The fake writer puts the topic name into each prompt; count across all pages.
    let parallel = prompts.filter((p) => p.includes("Resistors in parallel")).length;
    while (await page.getByRole("button", { name: "Next page" }).isVisible()) {
      await page.getByRole("button", { name: "Next page" }).click();
      parallel += (await page.locator("[data-question]").allInnerTexts()).filter((p) => p.includes("Resistors in parallel")).length;
    }
    expect(parallel).toBeGreaterThanOrEqual(5);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("reaching the goal stops the track", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { name: "Maths: Linear equations", questions: paper, topicNames: topics, goal: { threshold: 8, runLength: 1 } });
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await answerAll(page, () => true);
    await page.getByRole("button", { name: "Submit exam" }).click();
    await expect(page).toHaveURL(/\/result$/, { timeout: 20_000 });
    await expect(page.getByText("10 / 10", { exact: true })).toBeVisible();
    await expect(page.getByText("A perfect 10 / 10")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Goal reached!" })).toBeVisible();

    await page.goto("/tracks");
    await expect(page.getByRole("main")).toContainText("Goal reached. Well done!");
    await expect(page.getByRole("main")).toContainText("Waiting for new topics from your parent");
    await expect(page.getByRole("link", { name: /Start exam/ })).toHaveCount(0);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});
