import { expect, test } from "@playwright/test";

test("risky payment PR shows high merge risk and SQL inspector", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /run/i }).click();
  await expect(page.getByText(/Merge Risk/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /HIGH|CRITICAL/ })).toBeVisible();
  await expect(page.getByText("Block merge and escalate owner review.", { exact: true })).toBeVisible();
  await expect(page.getByText("Coral SQL Query Inspector")).toBeVisible();
  const query = page.locator("details").filter({ hasText: "risk.recent_errors_by_service" });
  await query.locator("summary").click();
  await expect(query.locator("pre")).toContainText("JOIN services USING");
});

test("docs-only PR stays low risk", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("GitHub PR").fill("demo/shop#7");
  await page.getByRole("button", { name: /run/i }).click();
  await expect(page.getByRole("heading", { name: "LOW" })).toBeVisible();
});
