import { expect, test, type Page } from "@playwright/test";
import { closeDb, createFamily, createTrackWithExam, deleteParentByEmail, type FixtureQuestion } from "../fixtures";
import { signInFully } from "./helpers";

test.afterAll(closeDb);

const topics = ["Ohm's law", "Resistors in series", "Resistors in parallel"];
const paper: FixtureQuestion[] = Array.from({ length: 10 }, (_, i) =>
  i < 6
    ? { type: "multiple_choice", prompt: `MCQ ${i + 1} on ${topics[i % 3]}`, options: ["right", "wrong one", "wrong two", "wrong three"], correct: 0 }
    : { type: "short", prompt: `Short ${i + 1} on ${topics[i % 3]}`, expected: "Ohm's law" },
);

async function takeAll(page: Page, right = true) {
  await expect(page.locator('[data-question="0"]')).toBeVisible();
  for (;;) {
    for (const i of await page.locator("[data-question]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-question"))))) {
      const q = page.locator(`[data-question="${i}"]`);
      if (await q.getByRole("radio").count()) await q.locator("label", { hasText: right ? "Option A:" : "Option B:" }).click();
      else await q.getByRole("textbox").fill(right ? "ohms law" : "no idea");
    }
    const next = page.getByRole("button", { name: "Next page" });
    if (!(await next.isVisible())) break;
    await next.click();
  }
  await page.getByRole("button", { name: "Submit exam" }).click();
  await expect(page).toHaveURL(/\/result$/, { timeout: 20_000 });
}

const chat = async (page: Page, text: string) => {
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("owlrnd AI is reading…")).toHaveCount(0, { timeout: 15_000 });
};

test("M6 done-when: a track stops at its goal and restarts after topics are added", async ({ page, browser }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { name: "Physics: Current electricity", questions: paper, topicNames: topics, goal: { threshold: 8, runLength: 1 } });

    // The student reaches the goal: no Start any more.
    const kidCtx = await browser.newContext();
    const kid = await kidCtx.newPage();
    await signInFully(kid, student.username, student.password, parent.email, /\/today$/);
    await kid.getByRole("link", { name: /Start exam 1/ }).click();
    await takeAll(kid);
    await expect(kid.getByRole("heading", { name: "Goal reached!" })).toBeVisible();
    await kid.goto("/tracks");
    await expect(kid.getByRole("link", { name: /Start exam/ })).toHaveCount(0);

    // 2i: the parent sees it stopped.
    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.goto(`/students/${studentId}/tracks`);
    await expect(page.getByText("Goal reached on Physics: Current electricity.")).toBeVisible();
    const card = page.getByRole("article");
    await expect(card).toContainText(/Goal reached on \d+ \w+ · stopped/);
    await expect(card).toContainText("Reached");

    // 2j: add topics, agree, start again.
    await card.getByRole("link", { name: "Add topics to continue" }).click();
    await expect(page.getByRole("heading", { name: "Add topics: Physics: Current electricity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start the track again" })).toBeDisabled();
    await chat(page, "Add chapter 13: magnetic field lines and electromagnets.");
    const panel = page.getByRole("complementary", { name: "Track update" });
    await expect(panel).toContainText("Magnetic field lines, Electromagnets");
    await expect(panel).toContainText("The 3 earlier topics");
    await expect(panel).toContainText("8 / 10 or better in 3 exams in a row");
    await chat(page, "Yes, start it.");
    await page.getByRole("button", { name: "Start the track again" }).click();
    await expect(page.getByText(/is active again with the new topics/)).toBeVisible();
    await expect(panel).toContainText("Active again");

    await page.getByRole("link", { name: /Back to .* tracks/ }).click();
    const again = page.getByRole("article");
    await expect(again).toContainText("Active");
    await expect(again).toContainText("0 of 3");

    // The student gets the next exam, with about 2 revision questions on the earlier topics.
    await expect(async () => {
      await kid.goto("/today");
      await expect(kid.getByRole("link", { name: /Start exam 2/ })).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });
    await kid.getByRole("link", { name: /Start exam 2/ }).click();
    await expect(kid.locator('[data-question="0"]')).toBeVisible();
    let texts = await kid.locator("[data-question]").allInnerTexts();
    while (await kid.getByRole("button", { name: "Next page" }).isVisible()) {
      await kid.getByRole("button", { name: "Next page" }).click();
      texts = texts.concat(await kid.locator("[data-question]").allInnerTexts());
    }
    expect(texts.filter((t) => topics.some((n) => t.includes(n)))).toHaveLength(2);
    await kidCtx.close();
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("Add material on an active track: the AI explains, the parent applies, the goal progress stays", async ({ page, browser }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { name: "Physics: Current electricity", questions: paper, topicNames: topics });
    const kidCtx = await browser.newContext();
    const kid = await kidCtx.newPage();
    await signInFully(kid, student.username, student.password, parent.email, /\/today$/);
    await kid.getByRole("link", { name: /Start exam 1/ }).click();
    await takeAll(kid); // 10/10 → progress 1 of 3
    await kidCtx.close();

    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.goto(`/students/${studentId}/tracks`);
    await page.getByRole("link", { name: "Add material to Physics: Current electricity" }).click();
    await expect(page.getByRole("heading", { name: "Add material: Physics: Current electricity" })).toBeVisible();
    await chat(page, "Add chapter 13: electromagnets.");
    await expect(page.getByText(/I would add Electromagnets from the next exam, with the goal stays/)).toBeVisible();
    const panel = page.getByRole("complementary", { name: "Track update" });
    await expect(panel).toContainText("Stays: 8 / 10 or better in 3 exams in a row, with every topic strong · progress 1 of 3");
    await chat(page, "Yes please.");
    await page.getByRole("button", { name: "Apply changes" }).click();
    await expect(page.getByText(/Electromagnets is now part of Physics: Current electricity/)).toBeVisible();

    await page.goto(`/students/${studentId}/tracks`);
    await expect(page.getByRole("article")).toContainText("1 of 3");
    await expect(page.getByRole("article").locator('ul[aria-label*="Electromagnets: not tested yet"]')).toBeVisible();
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("exam history, marked papers for parents, archive, points page and activity charts", async ({ page, browser }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { name: "Maths: Linear equations", questions: paper, topicNames: topics, goal: { threshold: 8, runLength: 1 } });
    const kidCtx = await browser.newContext();
    const kid = await kidCtx.newPage();
    await signInFully(kid, student.username, student.password, parent.email, /\/today$/);
    await kid.getByRole("link", { name: /Start exam 1/ }).click();
    await takeAll(kid);
    const earned = await kid.getByRole("region", { name: "Points earned" }).locator("p").first().innerText(); // "+40"

    // Points page
    await kid.getByRole("link", { name: "See your points" }).click();
    await expect(kid).toHaveURL(/\/points$/);
    await expect(kid.getByRole("region", { name: "Your points" })).toContainText(earned.replace("+", ""));
    await expect(kid.getByRole("region", { name: "Earned today" })).toContainText(earned);
    await expect(kid.getByText("Finished 1 exam")).toBeVisible();
    await expect(kid.getByRole("progressbar")).toBeVisible();
    await expect(kid.getByRole("complementary").getByRole("link", { name: /points/ })).toHaveAttribute("href", "/points");

    // Activity charts on Today
    await kid.goto("/today");
    await expect(kid.getByRole("heading", { name: "Exams you practised in the last 7 days" })).toBeVisible();
    await expect(kid.getByText("1 exam in the last 26 weeks")).toBeVisible();
    await expect(kid.locator("[data-today]")).toHaveCount(1);
    await expect(kid.locator('[title*="(today)"]')).toHaveAttribute("title", /1 exam \(today\)/);

    // Parent: charts on 2k, history, marked paper, archive
    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await expect(page.getByText("Last 26 weeks", { exact: true })).toBeVisible();
    await page.goto(`/students/${studentId}/tracks`);
    // The goal-reached card offers Add topics and Archive; its history page is the track's own page.
    const updateHref = await page.getByRole("link", { name: "Add topics to continue" }).getAttribute("href");
    await page.goto(updateHref!.replace(/\/update$/, ""));
    await expect(page.getByRole("table")).toContainText("Exam 1");
    await expect(page.getByRole("table")).toContainText("10 / 10");
    await page.getByRole("link", { name: "Marked paper for exam 1" }).click();
    await expect(page.locator('[data-question="0"]')).toContainText("Correct.");
    await page.getByRole("link", { name: "Back to exam history" }).first().click();
    await expect(page.getByRole("table")).toBeVisible();

    await page.goto(`/students/${studentId}/tracks`);
    await page.getByRole("button", { name: "Archive Maths: Linear equations" }).click();
    await page.getByRole("group", { name: /Archive/ }).getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Archived tracks (1)")).toBeVisible();
    await kid.goto("/tracks");
    await expect(kid.getByRole("main")).not.toContainText("Linear equations");

    // Roadmap 22: restore puts it back as it was; delete removes it for good, and the points stay.
    await page.getByText("Archived tracks (1)").click();
    await page.getByRole("button", { name: "Restore Maths: Linear equations" }).click();
    await expect(page.getByRole("link", { name: "Add topics to continue" })).toBeVisible();
    await expect(page.getByText("Archived tracks (1)")).toHaveCount(0);
    await page.getByRole("button", { name: "Archive Maths: Linear equations" }).click();
    await page.getByRole("group", { name: /Archive/ }).getByRole("button", { name: "Archive" }).click();
    await page.getByText("Archived tracks (1)").click();
    await page.getByRole("button", { name: "Delete Maths: Linear equations" }).click();
    await expect(page.getByRole("group", { name: /Delete/ })).toContainText("for good");
    await page.getByRole("button", { name: "Delete for good" }).click();
    await expect(page.getByRole("heading", { name: "No tracks yet" })).toBeVisible();
    await expect(page.getByText(/Archived tracks/)).toHaveCount(0);
    await kid.goto("/points");
    await expect(kid.getByRole("region", { name: "Your points" })).toContainText(earned.replace("+", ""));
    await kidCtx.close();
  } finally {
    await deleteParentByEmail(parent.email);
  }
});
