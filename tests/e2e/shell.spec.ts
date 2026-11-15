import { expect, test } from "@playwright/test";

test("health endpoint reports the database is up", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ ok: true, db: "up" });
});

test("student shell: points box and profile menu", async ({ page }) => {
  await page.goto("/dev/shell?role=student");
  await expect(page.getByText("5,640")).toBeVisible();
  await expect(page.getByText("points · Champion level")).toBeVisible();
  const menuButton = page.getByRole("button", { name: "Account menu for Scout" });
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.click();
  await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Profile" })).toBeHidden();
});

test("parent shell has no points box", async ({ page }) => {
  await page.goto("/dev/shell?role=parent");
  await expect(page.getByRole("heading", { name: "Your students" })).toBeVisible();
  await expect(page.getByText(/points/)).toHaveCount(0);
});
