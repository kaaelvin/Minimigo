import { test, expect } from "@playwright/test";

test("o app monta o canvas do pet", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 10000 });
});
