import { test, expect } from "@playwright/test";

test("o app monta o canvas do pet", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 10000 });
});

test("a barra de cuidado aparece no hover com os 2 botões", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

  const bar = page.getByTestId("care-bar");
  await expect(bar).toBeHidden();

  await page.locator(".pet-root").hover();

  await expect(bar).toBeVisible();
  await expect(page.getByTestId("feed-btn")).toBeVisible();
  await expect(page.getByTestId("sleep-btn")).toBeVisible();
});
