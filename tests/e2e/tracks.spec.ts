import { expect, test, type Page } from "@playwright/test";
import { closeDb, createFamily, deleteParentByEmail } from "../fixtures";
import { signInFully } from "./helpers";

// Runs against the fake AI (OWLRND_FAKE_AI=1 in playwright.config.ts).
test.afterAll(closeDb);

const preview = (page: Page) => page.getByRole("complementary", { name: "New track preview" });
const chatSend = async (page: Page, text: string) => {
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
};

test("M3 done-when: a parent creates a track from a description and photos, agrees a goal, and confirms", async ({ page }) => {
  const { parent, studentId, student } = await createFamily();
  try {
    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.goto(`/students/${studentId}/setup`);
    await page.getByRole("link", { name: "Start setting up" }).click();

    // 2d → 2e
    await expect(page.getByRole("heading", { name: "No tracks yet" })).toBeVisible();
    await page.getByRole("link", { name: "Create the first track" }).click();
    await expect(page.getByRole("heading", { name: `Create ${student.name}'s first track` })).toBeVisible();
    await expect(preview(page)).toContainText("Draft");
    await expect(page.getByRole("button", { name: "Create track" })).toBeDisabled();

    // Description + two page photos → the AI proposes a name, topics and the default goal.
    await page.getByTestId("attach-file-input").setInputFiles(["tests/fixtures-files/page-142.png", "tests/fixtures-files/page-143.png"]);
    await expect(page.getByRole("list", { name: "Files to send" }).getByRole("listitem")).toHaveCount(2);
    await chatSend(page, "Physics unit test on 2099-11-20. Chapter 12: Ohm's law, resistors in series and resistors in parallel.");
    await expect(page.getByText("owlrnd AI is reading…")).toBeVisible();
    await expect(page.getByText(/I can create a track called "Physics: Ohm's law"/)).toBeVisible();
    await expect(page.getByRole("list", { name: "Attached" })).toContainText("Page 141");
    await expect(preview(page)).toContainText("Physics: Ohm's law");
    await expect(preview(page)).toContainText("Ohm's law, Resistors in series, Resistors in parallel");
    await expect(preview(page)).toContainText("Fri 20 Nov");
    await expect(preview(page)).toContainText("8 / 10 or better in 3 exams in a row");
    await expect(preview(page)).toContainText("Draft");
    await expect(page.getByRole("button", { name: "Create track" })).toBeDisabled();

    // The conversation survives a reload.
    await page.reload();
    await expect(page.getByText(/I can create a track called/)).toBeVisible();

    // The parent changes the goal → Ready.
    await chatSend(page, "Yes. Make the goal 9 / 10 in 3 exams in a row.");
    await expect(preview(page)).toContainText("9 / 10 or better in 3 exams in a row");
    await expect(preview(page)).toContainText("Ready");

    // Confirm → the AI's confirmation, then 2g.
    await page.getByRole("button", { name: "Create track" }).click();
    await expect(page.getByText(/is Scout's first track, with the goal 9 \/ 10/)).toBeVisible();
    await expect(page.getByRole("heading", { name: `Create ${student.name}'s first track` })).toBeVisible(); // not "a new track"
    await page.getByRole("link", { name: `Open ${student.name}'s tracks` }).click();

    await expect(page.getByText("First track created.")).toBeVisible();
    const card = page.getByRole("article");
    await expect(card).toContainText("New · unit test on Fri 20 Nov");
    await expect(card).toContainText("Physics: Ohm's law");
    await expect(card).toContainText("0 of 3 topics strong");
    await expect(card).toContainText("Goal: 9 / 10 or better in 3 exams in a row");
    await expect(card).toContainText("0 of 3");

    // The background job writes the first exam.
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole("article")).toContainText("first exam is ready", { timeout: 1000 });
    }).toPass({ timeout: 20_000 });
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("starter buttons fill the message box; Start over clears the chat", async ({ page }) => {
  const { parent, studentId } = await createFamily();
  try {
    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.goto(`/students/${studentId}/tracks/new`);
    await page.getByRole("button", { name: "A chapter for an upcoming unit test" }).click();
    await expect(page.getByLabel("Message")).toHaveValue(/Unit test on <date>/);

    await chatSend(page, "Maths chapter 4: quadratic equations and factorisation.");
    await expect(preview(page)).toContainText("Maths: Quadratic equations");
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(page.getByText("Or start with one of these")).toBeVisible();
    await expect(preview(page)).toContainText("Fills in as you chat.");
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("pause and resume a track", async ({ page }) => {
  const { parent, studentId } = await createFamily();
  try {
    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.goto(`/students/${studentId}/tracks/new`);
    await chatSend(page, "Biology chapter 2: cells and tissues.");
    await expect(preview(page)).toContainText("Biology: Cells");
    await chatSend(page, "Looks good.");
    await page.getByRole("button", { name: "Create track" }).click();
    await page.getByRole("link", { name: /Open .* tracks/ }).click();

    await page.getByRole("button", { name: "Pause Biology: Cells" }).click();
    await expect(page.getByRole("article")).toContainText("Paused");
    await page.getByRole("button", { name: "Resume Biology: Cells" }).click();
    await expect(page.getByRole("button", { name: "Pause Biology: Cells" })).toBeVisible();
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

test("track pages belong to the student's parent only", async ({ page, browser }) => {
  const a = await createFamily();
  const b = await createFamily();
  try {
    await signInFully(page, a.parent.email, a.parent.password, a.parent.email, /\/students$/);
    for (const path of [`/students/${b.studentId}/tracks`, `/students/${b.studentId}/tracks/new`]) {
      expect((await page.goto(path))?.status()).toBe(404);
    }
    const ctx = await browser.newContext();
    const kid = await ctx.newPage();
    await signInFully(kid, a.student.username, a.student.password, a.parent.email, /\/today$/);
    await kid.goto(`/students/${a.studentId}/tracks/new`);
    await expect(kid).toHaveURL(/\/today$/);
    await ctx.close();
  } finally {
    await deleteParentByEmail(a.parent.email);
    await deleteParentByEmail(b.parent.email);
  }
});
