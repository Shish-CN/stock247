import { expect, test } from "@playwright/test";

test("dashboard remains readable on desktop and mobile", async ({ page }) => {
  await page.route("**/v1/markets/top?limit=20", async (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ data: [], meta: { limit: 20, generatedAt: new Date().toISOString(), contractSource: "Hyperliquid", stockSource: "not-configured", stockProviderConfigured: false, partialFailures: {} } })
  }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "美股现货与链上永续合约价差" })).toBeVisible();
  await expect(page.getByPlaceholder("搜索美股代码，例如 NVDA、TSLA、AAPL")).toBeVisible();
});
