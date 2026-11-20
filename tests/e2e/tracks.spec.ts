import { expect, test, type Page } from "@playwright/test";
import { attachmentsFor, closeDb, createFamily, deleteParentByEmail } from "../fixtures";
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
    // While the AI reads, no more files can be added and the sent files leave the message box.
    await expect(page.getByRole("button", { name: "Attach file" })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Files to send" })).toHaveCount(0);
    await expect(page.getByText(/I can create a track called "Physics: Ohm's law"/)).toBeVisible();
    await expect(page.getByRole("list", { name: "Attached" })).toContainText("Page 141");
    await expect(preview(page)).toContainText("Physics: Ohm's law");
    await expect(preview(page)).toContainText("Ohm's law, Resistors in series, Resistors in parallel");
    await expect(preview(page)).toContainText("Fri 20 Nov");
    await expect(preview(page)).toContainText("8 / 10 or better in 3 exams in a row");
    // Name, topics and goal are in: Create track works now (owner, 2026-11-16), though the chat can go on.
    await expect(preview(page)).toContainText("Ready");
    await expect(preview(page)).not.toContainText("Still needed");
    await expect(page.getByRole("button", { name: "Create track" })).toBeEnabled();

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

test("iPhone HEIC photos and uploads over 10 MB reach the AI (bug of 2026-11-15)", async ({ page }) => {
  const { parent, studentId } = await createFamily();
  try {
    await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
    await page.goto(`/students/${studentId}/tracks/new`);
    // Two 5.5 MB PDFs (browsers don't shrink PDFs) plus an HEIC photo: about 11 MB in one message.
    const pdf = (n: number) => ({ name: `chapter-${n}.pdf`, mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(5_500_000, 32)]) });
    await page.getByTestId("attach-file-input").setInputFiles(["tests/fixtures-files/sample-page.heic"]);
    await page.getByTestId("attach-file-input").setInputFiles([pdf(1), pdf(2)]);
    await chatSend(page, "Chemistry chapter, class 8 ICSE.");
    await expect(page.getByText("I couldn't answer just now")).toHaveCount(0);
    await expect(page.getByText(/I can create a track called/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("I couldn't answer just now")).toHaveCount(0);
    const stored = await attachmentsFor(studentId);
    expect(stored.map((a) => a.mediaType).sort()).toEqual(["application/pdf", "application/pdf", "image/jpeg"]);
    expect(stored.find((a) => a.mediaType === "image/jpeg")?.name).toBe("sample-page.jpg");
  } finally {
    await deleteParentByEmail(parent.email);
  }
});

for (const v of [
  { n: "laptop", width: 1280, height: 720 },
  { n: "phone", width: 390, height: 844 },
]) {
  test(`a long preview keeps Create track in view (${v.n}, owner 2026-11-16)`, async ({ browser }) => {
    const { parent, studentId } = await createFamily();
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height } });
    const page = await ctx.newPage();
    try {
      await signInFully(page, parent.email, parent.password, parent.email, /\/students$/);
      await page.goto(`/students/${studentId}/tracks/new`);
      await chatSend(
        page,
        "Physics unit test on 2099-11-20. Chapter 12: Ohm's law, resistors in series, resistors in parallel, electric power, heating effect of current, electric energy, resistivity, conductors and insulators, potential difference, electric current, circuit diagrams and ammeters.",
      );
      await expect(preview(page)).toContainText("and 7 more (12 in all)");
      const create = page.getByRole("button", { name: "Create track" }).locator("visible=true").first();
      await expect(create).toBeEnabled({ timeout: 15_000 });
      // Wherever the page is scrolled, a Create track button is on screen (the card's, or the phone's bottom bar).
      for (const y of [0, 100_000]) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        const onScreen = await page.evaluate(() =>
          [...document.querySelectorAll("button")].some((b) => {
            const r = b.getBoundingClientRect();
            return b.textContent?.trim() === "Create track" && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight;
          }),
        );
        expect(onScreen).toBe(true);
      }
    } finally {
      await deleteParentByEmail(parent.email);
      await ctx.close();
    }
  });
}
