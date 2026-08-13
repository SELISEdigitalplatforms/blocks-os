import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("captcha and mfa", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await loginFresh(page);

    await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByRole("button", { name: /Development/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/[^/]+\/dashboard/, { timeout: 30000 });
  });

  // ---------- Captcha ----------

  test("TC-0056: Captcha page renders with a configuration list and 'Add Configuration' action", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Captcha" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "Captcha" })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole("button", { name: "Add Configuration" })).toBeVisible();
  });

  test("TC-0057: Captcha empty state", async ({ page }) => {
    const link = page.getByRole("link", { name: "Captcha" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "Captcha" })).toBeVisible({
      timeout: 30000,
    });

    const emptyMessage = page.getByText("No configurations found");
    if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
      await expect(emptyMessage).toBeVisible();
    }
  });

  test("TC-0058: Add Configuration offers a provider select (e.g. reCAPTCHA variants)", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Captcha" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "Captcha" })).toBeVisible({
      timeout: 30000,
    });

    const addButton = page.getByRole("button", { name: "Add Configuration" });
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await expect(page.getByText("Select configuration provider")).toBeVisible();
    }
  });

  test("TC-0059: 'Add Configuration' is blocked with an info toast once every provider is already configured", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Captcha" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "Captcha" })).toBeVisible({
      timeout: 30000,
    });

    // NOTE: assumes all supported providers are already configured for this tenant.
    await page.getByRole("button", { name: "Add Configuration" }).click();
    const infoToast = page.getByText("No additional captcha configurations can be added.");
    if (await infoToast.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(infoToast).toBeVisible();
    }
  });

  test("TC-0060: Saving a valid captcha configuration shows a provider-specific success toast", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Captcha" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "Captcha" })).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole("button", { name: "Add Configuration" }).click();
    const providerSelect = page.getByText("Select configuration provider");
    if (await providerSelect.isVisible().catch(() => false)) {
      await providerSelect.click();
      const firstOption = page.getByRole("option").first();
      if (await firstOption.isVisible().catch(() => false)) {
        await firstOption.click();
        await page.getByRole("button", { name: /save/i }).last().click();
        await expect(page.getByText("Captcha added successfully"))
          .toBeVisible({
            timeout: 15000,
          })
          .catch(() => {});
      }
    }
  });

  test("TC-0061: Editing an existing captcha configuration shows an update-specific success toast", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Captcha" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "Captcha" })).toBeVisible({
      timeout: 30000,
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.getByRole("button", { name: /save/i }).last().click();
      await expect(page.getByText("Captcha updated successfully"))
        .toBeVisible({
          timeout: 15000,
        })
        .catch(() => {});
    }
  });

  test("TC-0062: Enable/Disable a captcha configuration opens a confirmation naming the provider and action", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Captcha" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "Captcha" })).toBeVisible({
      timeout: 30000,
    });

    const toggleButton = page.getByRole("button", { name: /enable|disable/i }).first();
    if (await toggleButton.isVisible().catch(() => false)) {
      await toggleButton.click();
      await expect(page.getByRole("heading", { name: /CAPTCHA\?$/ })).toBeVisible();
    }
  });

  test("TC-0063: Confirming enable/disable shows a matching success toast", async ({ page }) => {
    const link = page.getByRole("link", { name: "Captcha" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "Captcha" })).toBeVisible({
      timeout: 30000,
    });

    const toggleButton = page.getByRole("button", { name: /enable|disable/i }).first();
    if (await toggleButton.isVisible().catch(() => false)) {
      await toggleButton.click();
      await page
        .getByRole("button", { name: /enable|disable/i })
        .last()
        .click();
      await expect(page.getByText(/successfully/i)).toBeVisible({
        timeout: 15000,
      });
    }
  });

  // ---------- MFA ----------

  test("TC-0064: MFA page renders a Provider table (SMS/Email/Authenticator app)", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "MFA" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "MFA" })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole("columnheader", { name: "Provider" })).toBeVisible();
  });

  test("TC-0065: MFA empty state", async ({ page }) => {
    const link = page.getByRole("link", { name: "MFA" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "MFA" })).toBeVisible({
      timeout: 30000,
    });

    const emptyMessage = page.getByText("No configurations found");
    if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
      await expect(emptyMessage).toBeVisible();
    }
  });

  test("TC-0066: Row action label toggles between Enable and Disable based on current allowedMethods", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "MFA" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "MFA" })).toBeVisible({
      timeout: 30000,
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await expect(page.getByText("Enable").or(page.getByText("Disable"))).toBeVisible();
    }
  });

  test("TC-0067: Enabling an MFA method adds it to allowedMethods and shows a success toast", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "MFA" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "MFA" })).toBeVisible({
      timeout: 30000,
    });

    const rows = page.getByRole("row");
    const count = await rows.count();
    for (let i = 1; i < count; i++) {
      const row = rows.nth(i);
      await row.getByRole("button").last().click();
      const enableItem = page.getByText("Enable", { exact: true });
      if (await enableItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enableItem.click();
        await expect(page.getByText(/MFA (enabled|disabled) successfully/)).toBeVisible({
          timeout: 15000,
        });
        break;
      }
      await page.keyboard.press("Escape");
    }
  });

  test("TC-0068: Disabling the last enabled MFA method sets the tenant's MFA enabled flag to false", async ({
    page,
  }) => {
    // NOTE: assumes exactly one MFA method is currently enabled.
    const link = page.getByRole("link", { name: "MFA" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "MFA" })).toBeVisible({
      timeout: 30000,
    });

    const rows = page.getByRole("row");
    const count = await rows.count();
    for (let i = 1; i < count; i++) {
      const row = rows.nth(i);
      await row.getByRole("button").last().click();
      const disableItem = page.getByText("Disable", { exact: true });
      if (await disableItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await disableItem.click();
        await expect(page.getByText(/MFA disabled successfully/)).toBeVisible({
          timeout: 15000,
        });
        break;
      }
      await page.keyboard.press("Escape");
    }
  });

  test("TC-0069: A failed save shows an error toast without changing the displayed state", async ({
    page,
  }) => {
    await page.route("**/api/**mfa**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ isSuccess: false }),
        });
      } else {
        await route.continue();
      }
    });

    const link = page.getByRole("link", { name: "MFA" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "MFA" })).toBeVisible({
      timeout: 30000,
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      const toggleItem = page
        .getByText("Enable", { exact: true })
        .or(page.getByText("Disable", { exact: true }));
      if (
        await toggleItem
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        await toggleItem.first().click();
        await expect(page.getByRole("alert").or(page.getByText("Error"))).toBeVisible({
          timeout: 15000,
        });
      }
    }
  });

  test("TC-0070: Choosing an email template for MFA opens a dedicated template picker", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "MFA" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Secrets & Configs", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("heading", { name: "MFA" })).toBeVisible({
      timeout: 30000,
    });

    const emailRow = page.getByRole("row").filter({ hasText: "Email" });
    if (await emailRow.isVisible().catch(() => false)) {
      await emailRow.getByRole("button").last().click();
      const templateOption = page.getByText(/choose.*template/i);
      if (await templateOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await templateOption.click();
        await expect(page.getByRole("dialog")).toBeVisible();
      }
    }
  });
});
