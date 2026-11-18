import { expect, test, type Page } from "@playwright/test";
import { closeDb, createFamily, createTrackWithExam, deleteParentByEmail, type FixtureQuestion } from "../fixtures";
import { signInFully } from "./helpers";

test.afterAll(closeDb);

const noScroll = (page: Page) => page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight);
/** Click option A–D of a question (the visible label; the radio itself is visually hidden). */
const pick = (page: Page, index: number, letter: "A" | "B" | "C" | "D") =>
  page.locator(`[data-question="${index}"] label`, { hasText: `Option ${letter}:` }).click();
const visibleNumbers = async (page: Page) =>
  (await page.locator("[data-question]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-question")) + 1))).sort((a, b) => a - b);

test("M4 done-when: a student starts a suggested exam, answers, gets the blank warning and submits", async ({ page, browser }) => {
  const { parent, student } = await createFamily();
  try {
    // The parent creates a track with the (fake) AI; its first exam is written in the background.
    const parentCtx = await browser.newContext();
    const p = await parentCtx.newPage();
    await signInFully(p, parent.email, parent.password, parent.email, /\/students$/);
    await p.getByRole("link", { name: "Tracks for Scout" }).click();
    await p.getByRole("link", { name: "Create the first track" }).click();
    await p.getByLabel("Message").fill("Physics unit test on 2099-11-20. Chapter 12: Ohm's law, resistors in series and resistors in parallel.");
    await p.getByRole("button", { name: "Send" }).click();
    await expect(p.getByText(/I can create a track/)).toBeVisible();
    await p.getByLabel("Message").fill("Looks good.");
    await p.getByRole("button", { name: "Send" }).click();
    await p.getByRole("button", { name: "Create track" }).click();
    await p.getByRole("link", { name: /Open .* tracks/ }).click();
    await expect(p.getByText("First track created.")).toBeVisible(); // navigation done before reloading
    await expect(async () => {
      await p.reload();
      await expect(p.getByRole("article")).toContainText("first exam is ready", { timeout: 1000 });
    }).toPass({ timeout: 20_000 });
    await parentCtx.close();

    // The student's first day (3f) suggests Exam 1.
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);
    await expect(page.getByRole("heading", { name: `Welcome, ${student.name}` })).toBeVisible();
    await expect(page.getByText("Exam 1")).toBeVisible();
    // The activity charts show from the first day (owner, 2026-11-18), empty until the first exam.
    await expect(page.getByText("0 exams in the last 26 weeks")).toBeVisible();
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await expect(page).toHaveURL(/\/exam\//);
    await expect(page.getByRole("heading", { name: /Physics: Ohm's law/ })).toBeVisible();

    // Answer everything except one short question, across however many pages there are.
    const blankQuestion = 7;
    for (;;) {
      expect(await noScroll(page)).toBe(true);
      for (const n of await visibleNumbers(page)) {
        const q = page.locator(`[data-question="${n - 1}"]`);
        if (await q.getByRole("radio").count()) await pick(page, n - 1, "B");
        else if (n !== blankQuestion) await q.getByRole("textbox").fill(`answer ${n}`);
      }
      const next = page.getByRole("button", { name: "Next page" });
      if (!(await next.isVisible())) break;
      await expect(page.getByRole("button", { name: "Submit exam" })).toHaveCount(0);
      await next.click();
    }

    await page.getByRole("button", { name: "Submit exam" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("1 question is not answered");
    await expect(dialog).toContainText(`Question ${blankQuestion} is blank. Unanswered questions count as wrong.`);
    await dialog.getByRole("button", { name: `Go to question ${blankQuestion}` }).click();
    const box = page.locator(`[data-question="${blankQuestion - 1}"]`).getByRole("textbox");
    await expect(box).toBeFocused();
    await box.fill("Ohm's law");
    // Go to the last page and submit.
    while (await page.getByRole("button", { name: "Next page" }).isVisible()) await page.getByRole("button", { name: "Next page" }).click();
    await page.getByRole("button", { name: "Submit exam" }).click();

    // Marking runs in the background; the result opens by itself (M5).
    await expect(page).toHaveURL(/\/result$/, { timeout: 20_000 });
    await page.goto("/today?tab=recent");
    // The overall scores chart opens Past exams; each marked exam links to its result and its marked paper.
    await expect(page.getByRole("region", { name: "All your exams" })).toContainText("1 exam marked");
    await expect(page.getByRole("main")).toContainText("Physics: Ohm's law · Exam 1");
    await expect(page.getByRole("link", { name: /Result of Physics: Ohm's law, exam 1/ })).toBeVisible();
    await page.getByRole("link", { name: /Marked paper of Physics: Ohm's law, exam 1/ }).click();
    await expect(page).toHaveURL(/\/marked\?from=past$/);
    await page.getByRole("link", { name: "Back to past exams" }).first().click();
    await expect(page).toHaveURL(/tab=recent$/);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

/** Waits until the paper has been paged for the size it now has (a resize re-pages after a short pause). */
async function settled(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const a = document.querySelector<HTMLElement>("[data-paged-for]");
        return !!a && a.dataset.pagedFor === `${a.clientWidth}x${a.clientHeight}`;
      }),
    )
    .toBe(true);
  await page.waitForTimeout(50); // let React show the new pages
}

const longPaper: FixtureQuestion[] = Array.from({ length: 10 }, (_, i) =>
  i < 6
    ? {
        type: "multiple_choice",
        prompt: `A circuit has three resistors of 2 Ω, 3 Ω and 6 Ω. Two of them are joined in parallel and the result is joined in series with the third, across a 12 V battery whose internal resistance can be ignored. Which arrangement draws the largest current from the battery? (${i + 1})`,
        options: ["2 Ω in series with (3 Ω ∥ 6 Ω)", "3 Ω in series with (2 Ω ∥ 6 Ω)", "6 Ω in series with (2 Ω ∥ 3 Ω)", "All three draw the same current"],
        correct: 0,
      }
    : { type: "short", prompt: `Explain in one sentence why the equivalent resistance of resistors in parallel is always smaller than the smallest of them. (${i + 1})`, expected: "x" },
);

for (const size of [
  { width: 1280, height: 800 },
  { width: 1024, height: 640 },
  { width: 390, height: 844 },
]) {
  test(`the paper never scrolls at ${size.width}×${size.height}; numbering runs on; Submit only on the last page`, async ({ page }) => {
    const { parent, student, studentId } = await createFamily();
    try {
      await createTrackWithExam(studentId, { questions: longPaper });
      await page.setViewportSize(size);
      await signInFully(page, student.username, student.password, parent.email, /\/today$/);
      await page.getByRole("link", { name: /Start exam 1/ }).click();
      await expect(page.locator("[data-question]").first()).toBeVisible();
      await settled(page);

      const seen: number[] = [];
      let pages = 0;
      for (;;) {
        pages++;
        expect(await noScroll(page), `page ${pages} scrolls`).toBe(true);
        // Every question on the page is fully inside the window.
        const bottoms = await page.locator("[data-question]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
        const footerTop = await page.locator("footer").evaluate((f) => f.getBoundingClientRect().top);
        for (const b of bottoms) expect(b).toBeLessThanOrEqual(footerTop + 1);
        seen.push(...(await visibleNumbers(page)));
        await expect(page.getByText(new RegExp(`Page ${pages} of \\d+`))).toBeVisible();
        const next = page.getByRole("button", { name: "Next page" });
        if (!(await next.isVisible())) break;
        await expect(page.getByRole("button", { name: "Submit exam" })).toHaveCount(0);
        await next.click();
      }
      expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(pages).toBeGreaterThan(1);
      await expect(page.getByRole("button", { name: "Submit exam" })).toBeVisible();
      // Text is never shrunk below 16px.
      const sizes = await page.locator("[data-question] legend, [data-question] p").evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
      for (const s of sizes) expect(s).toBeGreaterThanOrEqual(16);
    } finally {
      await deleteParentByEmail(parent.email);
    }
  });
}

test("the paper pages again when its area shrinks without a window resize (iPad leaving full screen)", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId);
    await page.setViewportSize({ width: 1180, height: 820 });
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await expect(page.locator("[data-question]").first()).toBeVisible();
    // Squeeze the paper from inside the page: no window resize event fires, as when an iPad's full screen animates out.
    await page.locator("[data-question]").first().evaluate((el) => {
      (el.closest(".h-dvh") as HTMLElement).style.paddingBottom = "300px";
    });
    // Rules §5: every question fits, except one taller than a whole column, which gets that column to itself.
    await expect(async () => {
      const bottoms = await page
        .locator("[data-paper-column]")
        .evaluateAll((cols) => cols.filter((c) => c.childElementCount > 1).flatMap((c) => [...c.children].map((q) => q.getBoundingClientRect().bottom)));
      const footerTop = await page.locator("footer").evaluate((f) => f.getBoundingClientRect().top);
      expect(bottoms.length).toBeGreaterThan(0);
      for (const b of bottoms) expect(b).toBeLessThanOrEqual(footerTop + 1);
    }).toPass({ timeout: 3000 });
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("resizing pages again but keeps answers and the question the student was on", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { questions: longPaper });
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await settled(page);
    await pick(page, 0, "C");
    // Go to the last page and type into question 10.
    while (await page.getByRole("button", { name: "Next page" }).isVisible()) await page.getByRole("button", { name: "Next page" }).click();
    const q10 = page.locator('[data-question="9"]').getByRole("textbox");
    await q10.fill("because the paths add up");

    // Start opened the paper in full screen; the browser can only resize a normal window.
    await page.getByRole("button", { name: "Exit full screen" }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await settled(page);
    await expect(page.locator('[data-question="9"]')).toBeVisible(); // still on the page holding question 10
    await expect(page.locator('[data-question="9"]').getByRole("textbox")).toHaveValue("because the paths add up");
    expect(await noScroll(page)).toBe(true);

    await page.setViewportSize({ width: 1280, height: 800 });
    await settled(page);
    await expect(page.locator('[data-question="9"]').getByRole("textbox")).toHaveValue("because the paths add up");
    while (await page.getByRole("button", { name: "Previous page" }).isVisible()) await page.getByRole("button", { name: "Previous page" }).click();
    await expect(page.locator('[data-question="0"]').getByRole("radio").nth(2)).toBeChecked();
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("leaving keeps the answers; the dashboard offers Continue", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId);
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await pick(page, 1, "D");
    await page.locator('[data-question="7"]').getByRole("textbox").fill("Ohm's law");
    await expect(page.getByText("Saved")).toBeVisible();
    await page.getByRole("button", { name: "Leave exam" }).click();
    await expect(page).toHaveURL(/\/today$/);

    await page.getByRole("link", { name: /Continue exam 1/ }).click();
    await expect(page.getByText("Page 1 of 1")).toBeVisible(); // 10 short questions fit one page at 1280×800, as in 4.1b
    await expect(page.locator('[data-question="1"]').getByRole("radio").nth(3)).toBeChecked();
    await expect(page.locator('[data-question="7"]').getByRole("textbox")).toHaveValue("Ohm's law");
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("Start opens the paper in full screen; the top bar leaves and re-enters it; Leave exam exits it", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  const inFullscreen = () => page.evaluate(() => document.fullscreenElement !== null);
  try {
    await createTrackWithExam(studentId);
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await expect(page.getByText("Page 1 of 1")).toBeVisible();
    await expect.poll(inFullscreen).toBe(true);
    await pick(page, 2, "B");
    await expect(page.getByText("Saved")).toBeVisible();

    // Leaving full screen doesn't leave the exam, and keeps the answer.
    await page.getByRole("button", { name: "Exit full screen" }).click();
    await expect.poll(inFullscreen).toBe(false);
    await expect(page).toHaveURL(/\/exam\//);
    await expect(page.locator('[data-question="2"]').getByRole("radio").nth(1)).toBeChecked();
    expect(await noScroll(page)).toBe(true);

    await page.getByRole("button", { name: "Full screen", exact: true }).click();
    await expect.poll(inFullscreen).toBe(true);
    expect(await noScroll(page)).toBe(true);

    await page.getByRole("button", { name: "Leave exam" }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect.poll(inFullscreen).toBe(false);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("0.2: answers survive Back, Forward and reload, on every page; Back after submit goes to the result side", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    const { examId } = await createTrackWithExam(studentId);
    await page.setViewportSize({ width: 390, height: 844 }); // several pages on a phone
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await expect(page).toHaveURL(new RegExp(`/exam/${examId}$`));

    // Page 1: a choice. Then the last page: type and press Back at once, before the save pause.
    await pick(page, 0, "B");
    while (await page.getByRole("button", { name: "Next page" }).isVisible()) await page.getByRole("button", { name: "Next page" }).click();
    const last = page.locator('[data-question="9"]').getByRole("textbox");
    await last.fill("Ohm's law");
    await page.goBack();
    await expect(page).toHaveURL(/\/today$/);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/exam/${examId}$`));
    await expect(page.locator('[data-question="0"]').getByRole("radio").nth(1)).toBeChecked();
    while (await page.getByRole("button", { name: "Next page" }).isVisible()) await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.locator('[data-question="9"]').getByRole("textbox")).toHaveValue("Ohm's law");

    // Reload mid-exam, straight after typing.
    await page.locator('[data-question="9"]').getByRole("textbox").fill("Ohm's law again");
    await page.reload();
    while (await page.getByRole("button", { name: "Next page" }).isVisible()) await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.locator('[data-question="9"]').getByRole("textbox")).toHaveValue("Ohm's law again");

    // Another learner's exam can't be written through the leaving route.
    const other = await createFamily();
    const { examId: otherExam } = await createTrackWithExam(other.studentId);
    const res = await page.request.post(`/api/exam/${otherExam}/answers`, { data: { answers: { x: { text: "hi" } } } });
    expect((await res.json()).saved).toBe(0);
    await deleteParentByEmail(other.parent.email);

    // Submit, then Back: never an editable paper again.
    await page.getByRole("button", { name: "Submit exam" }).click();
    const submitAnyway = page.getByRole("button", { name: "Submit anyway" });
    if (await submitAnyway.isVisible().catch(() => false)) await submitAnyway.click();
    await expect(page).toHaveURL(/\/(marking|result)$/, { timeout: 20_000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/(marking|result)$|\/today$/);
    await expect(page.getByRole("button", { name: "Submit exam" })).toHaveCount(0);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("Your tracks (4.1a) and the caught-up state (3g)", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { name: "Physics: Current electricity", testDate: "2099-11-20" });
    await createTrackWithExam(studentId, { name: "Physics: Refraction of light", status: "paused" });
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);

    await page.goto("/tracks");
    const cards = page.getByRole("main").getByRole("listitem").filter({ has: page.getByRole("heading") });
    await expect(cards.filter({ hasText: "Current electricity" })).toContainText("Next exam ready · unit test on Fri 20 Nov");
    await expect(cards.filter({ hasText: "Current electricity" }).getByRole("link", { name: "Start exam 1" })).toBeVisible();
    await expect(cards.filter({ hasText: "Refraction" })).toContainText("No new exams while paused");
    await expect(cards.filter({ hasText: "Refraction" }).getByRole("link")).toHaveCount(0);
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("all caught up (3g) when every track is paused or has reached its goal", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { name: "Maths: Linear equations", status: "goal_reached" });
    await createTrackWithExam(studentId, { name: "Physics: Refraction of light", status: "paused" });
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);
    await expect(page.getByRole("heading", { name: "You are all caught up" })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Paused by your parent");
    await expect(page.getByRole("main")).toContainText("Goal reached");
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("only the student can open their exam, and the paper carries no answers", async ({ page, browser }) => {
  const a = await createFamily();
  const b = await createFamily();
  try {
    const { examId } = await createTrackWithExam(a.studentId);
    // The student's own paper: no explanations or expected answers in the HTML.
    await signInFully(page, a.student.username, a.student.password, a.parent.email, /\/today$/);
    const res = await page.goto(`/exam/${examId}`);
    const html = (await res?.text()) ?? "";
    expect(html).not.toContain("SECRET-EXPLANATION");
    expect(html).not.toContain("expectedAnswer");
    expect(html).not.toContain("correctOption");

    // Another student: 404. A parent: sent back to their own home.
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await signInFully(other, b.student.username, b.student.password, b.parent.email, /\/today$/);
    expect((await other.goto(`/exam/${examId}`))?.status()).toBe(404);
    await ctx.close();

    const pctx = await browser.newContext();
    const parentPage = await pctx.newPage();
    await signInFully(parentPage, a.parent.email, a.parent.password, a.parent.email, /\/students$/);
    await parentPage.goto(`/exam/${examId}`);
    await expect(parentPage).toHaveURL(/\/students$/);
    await pctx.close();
  } finally {
    await deleteParentByEmail(a.parent.email);
    await deleteParentByEmail(b.parent.email);
  }
});

