import { expect, test } from "@playwright/test";

// Public pages linked from the landing page footer.
test("footer links open the privacy, terms and contact pages", async ({ page }) => {
  for (const [link, heading] of [
    ["Privacy", "Privacy policy"],
    ["Terms", "Terms of use"],
    ["Contact", "Contact"],
  ] as const) {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("link", { name: "hello@owlrnd.com" }).first()).toHaveAttribute("href", /^mailto:hello@owlrnd\.com/);
  }
});

test("the privacy policy names the operator and the AI provider", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByText("owlrnd is run by Unni Koroth")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How the AI uses your material" })).toBeVisible();
});

test("the header links to the open-source repository on GitHub", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /open source: view the code on GitHub/ })).toHaveAttribute("href", "https://github.com/ukkoroth/owlrnd");
});
