import { expect, test, type Page } from "@playwright/test";
import { closeDb, createFamily, createSelfLearner, createTrackWithExam, deleteLearnerByEmail, deleteParentByEmail, deleteSelfLearner, type FixtureQuestion, uid } from "../fixtures";
import { inboxCount, nextCode } from "../mailpit";
import { enterCode, signInFully } from "./helpers";

// M9 (0.2): a self-managed learner sets up and manages their own tracks, in their own shell. Fake AI.
test.afterAll(closeDb);

const topics = ["Ohm's law", "Resistors in series", "Resistors in parallel"];
const paper: FixtureQuestion[] = Array.from({ length: 10 }, (_, i) =>
  i < 6
    ? { type: "multiple_choice", prompt: `MCQ ${i + 1} on ${topics[i % 3]}`, options: ["right", "wrong one", "wrong two", "wrong three"], correct: 0 }
    : { type: "short", prompt: `Short ${i + 1} on ${topics[i % 3]}`, expected: "Ohm's law" },
);

/** Answers every question (Option A / "ohms law" are the fixture's right answers) and submits. */
async function takeAll(page: Page) {
  await expect(page.locator('[data-question="0"]')).toBeVisible();
  for (;;) {
    for (const i of await page.locator("[data-question]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-question"))))) {
      const q = page.locator(`[data-question="${i}"]`);
      if (await q.getByRole("radio").count()) await q.locator("label", { hasText: "Option A:" }).click();
      else await q.getByRole("textbox").fill("ohms law");
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

const noParentWording = async (page: Page) => expect(page.getByRole("main")).not.toContainText(/parent|child/i);

test("M9 done-when (1): sign up For me → choose your exam → build a track from a description and photos → take exam 1", async ({ page }) => {
  const email = `rancho-${uid()}@test.owlrnd`;
  try {
    // Sign up For me; after verifying, sm-2a.
    await page.goto("/sign-up?for=me");
    await page.getByLabel("Your name").fill("Rancho");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("learnerpass1");
    await page.getByLabel("Day").fill("12");
    await page.getByLabel("Month").selectOption({ label: "March" });
    await page.getByLabel("Year").fill("2000");
    await page.getByLabel(/I agree to the/).check();
    const before = await inboxCount(email);
    await page.getByRole("button", { name: "Create account" }).click();
    await enterCode(page, await nextCode(email, before));
    await page.getByRole("button", { name: "Verify email" }).click();

    await expect(page).toHaveURL(/\/tracks\/setup$/);
    await expect(page.getByRole("heading", { name: "Which exam are you preparing for?" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Packages coming soon" }).getByRole("listitem")).toHaveCount(8);
    const nav = page.getByRole("complementary").getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Exams" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Tracks" })).toBeVisible();
    await noParentWording(page);

    // sm-2d → 2e → 2f
    await page.getByRole("link", { name: "Build your own track" }).click();
    await expect(page.getByRole("heading", { name: "Create your first track" })).toBeVisible();
    await expect(page.getByText("Hi Rancho. Let's create your first track.")).toBeVisible();
    await expect(page.getByRole("button", { name: "A chapter from my exam syllabus" })).toBeVisible();
    await noParentWording(page);

    await page.getByTestId("attach-file-input").setInputFiles(["tests/fixtures-files/page-142.png", "tests/fixtures-files/page-143.png"]);
    await chat(page, "JEE Physics on 2099-11-20. Chapter 12: Ohm's law, resistors in series and resistors in parallel.");
    const preview = page.getByRole("complementary", { name: "New track preview" });
    await expect(preview).toContainText("Ohm's law, Resistors in series, Resistors in parallel");
    await expect(preview).toContainText("Exam date");
    await chat(page, "Yes, looks good.");
    await expect(preview).toContainText("Ready");
    await page.getByRole("button", { name: "Create track" }).click();
    await expect(page.getByText(/is your first track/)).toBeVisible();
    await page.getByRole("link", { name: "Open your tracks" }).click();

    // sm-4.1a: the card offers Start exam 1 once it is written.
    await expect(page.getByText("First track created.")).toBeVisible();
    await noParentWording(page);
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole("link", { name: /Start exam 1/ })).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await expect(page.locator('[data-question="0"]')).toBeVisible();
  } finally {
    await deleteLearnerByEmail(email);
  }
});

test("M9 done-when (2): a learner reaches the goal, then adds topics and the track starts again", async ({ page }) => {
  const { studentId, learner } = await createSelfLearner({ name: "Rancho" });
  try {
    await createTrackWithExam(studentId, { name: "JEE Physics: Current electricity", questions: paper, topicNames: topics, goal: { threshold: 8, runLength: 1 } });
    await signInFully(page, learner.email, learner.password, learner.email, /\/today$/);
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await takeAll(page);
    await expect(page.getByRole("heading", { name: "Goal reached!" })).toBeVisible();
    await expect(page.getByText("This track stops here until you add new topics.")).toBeVisible();

    await page.goto("/tracks");
    const card = page.getByRole("article");
    await expect(card).toContainText("Reached");
    await expect(page.getByRole("link", { name: /Start exam/ })).toHaveCount(0);
    await card.getByRole("link", { name: "Add topics to continue" }).click();

    await expect(page.getByRole("heading", { name: "Add topics: JEE Physics: Current electricity" })).toBeVisible();
    await expect(page.getByText(/You reached the goal/)).toBeVisible();
    await noParentWording(page);
    await chat(page, "Add chapter 13: magnetic field lines and electromagnets.");
    const panel = page.getByRole("complementary", { name: "Track update" });
    await expect(panel).toContainText("Magnetic field lines, Electromagnets");
    await chat(page, "Yes, start it.");
    await page.getByRole("button", { name: "Start the track again" }).click();
    await expect(panel).toContainText("Active again");
    await page.getByRole("link", { name: "Back to your tracks" }).click();
    await expect(page.getByRole("article")).toContainText("0 of 3");
  } finally {
    await deleteSelfLearner(studentId);
  }
});

test("a learner pauses, resumes, sees the history and archives a track from Your tracks", async ({ page }) => {
  const { studentId, learner } = await createSelfLearner({ name: "Rancho" });
  try {
    await createTrackWithExam(studentId, { name: "JEE Physics: Ray optics", questions: paper, topicNames: topics, goal: { threshold: 8, runLength: 3 } });
    await signInFully(page, learner.email, learner.password, learner.email, /\/today$/);
    await page.getByRole("complementary").getByRole("link", { name: "Tracks" }).click();
    await expect(page.getByRole("heading", { name: "Your tracks" })).toBeVisible();

    await page.getByRole("button", { name: "Pause JEE Physics: Ray optics" }).click();
    await expect(page.getByRole("button", { name: "Resume JEE Physics: Ray optics" })).toBeVisible();
    await page.goto("/today");
    await expect(page.getByRole("main")).not.toContainText(/parent/i);
    await page.goto("/tracks");
    await page.getByRole("button", { name: "Resume JEE Physics: Ray optics" }).click();
    await expect(page.getByRole("link", { name: /Start exam 1/ })).toBeVisible();

    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await takeAll(page);
    await page.goto("/tracks");
    await page.getByRole("link", { name: "Exam history of JEE Physics: Ray optics" }).click();
    await expect(page.getByRole("heading", { name: "JEE Physics: Ray optics" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Marked paper for exam 1" })).toHaveAttribute("href", /^\/exam\/[0-9a-f-]+\/marked$/);
  } finally {
    await deleteSelfLearner(studentId);
  }
});

test("a parent-managed learner can't open the learner's set-up screens, and the parent path is unchanged", async ({ page }) => {
  const { parent, student, studentId } = await createFamily();
  try {
    await createTrackWithExam(studentId, { name: "Physics: Ohm's law", questions: paper, topicNames: topics });
    await signInFully(page, student.username, student.password, parent.email, /\/today$/);
    for (const path of ["/tracks/setup", "/tracks/new", "/profile/password", "/profile/delete"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
    // Tracks in the sidebar opens their tracks read-only: topic strength and goal, no parent controls (owner, 2026-11-22).
    await page.goto("/today");
    await page.getByRole("complementary").getByRole("link", { name: "Tracks" }).click();
    await expect(page).toHaveURL(/\/tracks$/);
    await expect(page.getByRole("heading", { name: "Your tracks" })).toBeVisible();
    await expect(page.getByRole("complementary").getByRole("link", { name: "Tracks" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("main")).toContainText("Physics: Ohm's law");
    await expect(page.getByRole("main").getByRole("link", { name: /Add material|Pause|New track|Edit|Archive|Delete/ })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("button", { name: /Pause|Archive|Delete|Edit/ })).toHaveCount(0);
    if (process.env.PW_SHOTS) await page.screenshot({ path: `${process.env.PW_SHOTS}/child-tracks.png` });
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("a learner changes their password and email, then deletes their account", async ({ page, browser }) => {
  const { learner } = await createSelfLearner({ name: "Rancho" });
  const newEmail = `rancho-new-${uid()}@test.owlrnd`;
  try {
    await signInFully(page, learner.email, learner.password, learner.email, /\/today$/);
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signInFully(otherPage, learner.email, learner.password, learner.email, /\/today$/);

    // Password: other devices are signed out.
    await page.goto("/profile");
    await page.getByRole("link", { name: "Change password" }).click();
    await page.getByLabel("Current password").fill(learner.password);
    await page.getByLabel("New password").fill("newlearnerpass1");
    await page.getByLabel("Type it again").fill("newlearnerpass1");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Your password has been changed.")).toBeVisible();
    await otherPage.goto("/today");
    await expect(otherPage).toHaveURL(/\/sign-in/);
    await other.close();

    // Email: a code goes to the new address.
    await page.getByRole("link", { name: "Change email" }).click();
    await page.getByLabel("New email").fill(newEmail);
    const before = await inboxCount(newEmail);
    await page.getByRole("button", { name: "Send code" }).click();
    await enterCode(page, await nextCode(newEmail, before));
    await page.getByRole("button", { name: "Confirm email" }).click();
    await expect(page.getByText("Your email has been changed.")).toBeVisible();
    await expect(page.getByRole("main")).toContainText(newEmail);

    // Delete: signed out, and the account is gone.
    await page.getByRole("link", { name: "Delete my account" }).click();
    await page.getByLabel("Your password").fill("newlearnerpass1");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page).toHaveURL(/\/sign-in\?deleted=1$/);
    await page.getByLabel("Email or username").fill(newEmail);
    await page.getByLabel("Password").fill("newlearnerpass1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("That email or username and password don't match.");
  } finally {
    await deleteLearnerByEmail(newEmail);
    await deleteLearnerByEmail(learner.email);
  }
});

test("0.2 goal coverage: a full score run with an untested topic keeps the track going", async ({ page }) => {
  const { studentId, learner } = await createSelfLearner({ name: "Rancho" });
  try {
    await createTrackWithExam(studentId, {
      name: "JEE Physics: Current electricity",
      questions: paper,
      topicNames: topics,
      untestedTopics: ["Electric power"],
      goal: { threshold: 8, runLength: 1 },
    });
    await signInFully(page, learner.email, learner.password, learner.email, /\/today$/);
    await page.getByRole("link", { name: /Start exam 1/ }).click();
    await takeAll(page);
    await expect(page.getByRole("heading", { name: "Goal reached!" })).toHaveCount(0);
    await expect(page.getByText(/You've met the score part of the goal\. The track finishes once this topic is strong too: Electric power\./)).toBeVisible();

    await page.goto("/tracks");
    const card = page.getByRole("article");
    await expect(card).toContainText("1 of 1 exam · 3 of 4 topics strong");
    await expect(card).toContainText("with every topic strong");
    await expect(card).not.toContainText("Reached");
  } finally {
    await deleteSelfLearner(studentId);
  }
});
