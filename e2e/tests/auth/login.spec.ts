import { test, expect } from "../../support/test-base";
import { e2eCredentials } from "../../support/env";
import { loginThroughOidc } from "../../support/login-helper";

test.describe("Authentication", () => {
  test.beforeAll(() => {
    e2eCredentials();
  });

  test("logs in through dev-iam and lands on the console", async ({ page }) => {
    test.setTimeout(120_000);

    const holdMs = Number(process.env.E2E_HOLD_MS ?? 0);
    if (holdMs > 0) test.setTimeout(holdMs + 120_000);

    await loginThroughOidc(page);

    // Assert the console actually rendered — not just that the route changed.
    // The page shows "Your Blocks Projects" (has projects) or the empty-state
    // "Welcome to SELISE Blocks" (no projects). Either proves it loaded.
    await expect(
      page.getByRole("heading", {
        name: /Your Blocks Projects|Welcome to SELISE Blocks/,
      }),
    ).toBeVisible({ timeout: 20_000 });

    // Persist the authenticated session for future specs to reuse — saved
    // right after confirming login, before the logout below touches it.
    await page.context().storageState({ path: "fixtures/auth.json" });

    await page.getByRole("button", { name: "Open user menu" }).click();
    await page.getByText("Log out").click();
    await expect(page.getByRole("heading", { name: "blocks OS" })).toBeVisible({ timeout: 30_000 });

    // Optionally keep the browser open to inspect the result before it closes.
    // e.g. E2E_HOLD_MS=120000 npm run test:headed
    if (holdMs > 0) {
      await page.waitForTimeout(holdMs);
    }
  });
});
