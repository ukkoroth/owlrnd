import { expect, type Page } from "@playwright/test";
import { inboxCount, nextCode } from "../mailpit";

/** Form error box. (Next.js's route announcer also has role="alert", outside <main>.) */
export const formAlert = (page: Page) => page.getByRole("main").getByRole("alert");
export const formNotice = (page: Page) => page.getByRole("main").getByRole("status");

export async function enterCode(page: Page, code: string) {
  await page.getByLabel("Digit 1 of 6").fill(code); // spreads across the six boxes
}

/** Password step; returns the code emailed to `codeTo` (the parent's address). */
export async function signIn(page: Page, identifier: string, password: string, codeTo: string) {
  const before = await inboxCount(codeTo);
  await page.goto("/sign-in");
  await page.getByLabel("Email or username").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in\/code$/);
  return nextCode(codeTo, before);
}

/** Password + code, ending on the role's home page. */
export async function signInFully(page: Page, identifier: string, password: string, codeTo: string, home: RegExp) {
  await enterCode(page, await signIn(page, identifier, password, codeTo));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(home);
}

export async function signOut(page: Page, name: string) {
  await page.getByRole("button", { name: `Account menu for ${name}` }).click();
  await page.getByRole("complementary").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}
