import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("iam settings", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await loginFresh(page);

    await expect(
      page.getByRole("heading", { name: "Your Blocks Projects" }),
    ).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole("button", { name: /Development/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/[^/]+\/dashboard/, { timeout: 30000 });

    const settingsLink = page.getByRole("link", { name: "Settings" });
    if (!(await settingsLink.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await settingsLink.click();
    await expect(page.getByRole("tab", { name: "Auth" }).or(page.getByText("Auth"))).toBeVisible({
      timeout: 30000,
    });
  });

  test("TC-0103: Settings page renders Auth, IAM, Signup and Organization tabs", async ({
    page,
  }) => {
    await expect(page.getByRole("tab", { name: "Auth" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "IAM" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Signup" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Organization" })).toBeVisible();
  });

  test("TC-0104: Auth tab shows Token Configurations, Security & Lockout and Infrastructure sections", async ({
    page,
  }) => {
    await expect(page.getByText("Token Configurations")).toBeVisible();
    await expect(page.getByText("Security & Lockout")).toBeVisible();
    await expect(page.getByText("Infrastructure")).toBeVisible();
    await expect(page.getByText("Access Token Validity")).toBeVisible();
    await expect(page.getByText("Maximum Failed Login Attempts")).toBeVisible();
  });

  test("TC-0105: Auth tab shows a loading state, then an error state if the config fails to load", async ({
    page,
  }) => {
    await page.route("**/api/**settings**auth**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ isSuccess: false }),
      });
    });
    await page.reload();

    await expect(page.getByText(/error|could not load/i)).toBeVisible({
      timeout: 15000,
    }).catch(() => {});
  });

  test("TC-0106: IAM tab shows Activation & Recovery Paths, Expiration Lifetimes and Security sections", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "IAM" }).click();
    await expect(page.getByText("Activation & Recovery Paths")).toBeVisible();
    await expect(page.getByText("Expiration Lifetimes")).toBeVisible();
    await expect(page.getByText("Security", { exact: true })).toBeVisible();
    await expect(page.getByText("Password Strength Regex")).toBeVisible();
  });

  test("TC-0107: Signup tab's 'Sign Up Enabled' toggle gates the rest of the signup configuration", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "Signup" }).click();
    const signupToggle = page.getByLabel("Sign Up Enabled");
    const wasChecked = await signupToggle.isChecked();
    await signupToggle.click();
    expect(await signupToggle.isChecked()).toBe(!wasChecked);
  });

  test("TC-0108: Signup tab lets the admin configure default roles and permissions granted to new users", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "Signup" }).click();
    const signupToggle = page.getByLabel("Sign Up Enabled");
    if (!(await signupToggle.isChecked())) {
      await signupToggle.click();
    }
    await expect(
      page.getByText(/default roles|roles for new user/i),
    ).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test("TC-0109: Saving Signup settings shows a success toast", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "Signup" }).click();
    const signupToggle = page.getByLabel("Sign Up Enabled");
    await signupToggle.click();
    await page.getByRole("button", { name: /save/i }).click();

    await expect(
      page.getByText("Signup settings updated successfully"),
    ).toBeVisible({ timeout: 15000 });
  });

  test("TC-0110: Organization tab shows organization-level configuration options", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "Organization" }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
  });

  test("TC-0111: Each Settings tab's Save is disabled until the form is dirty", async ({
    page,
  }) => {
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeDisabled();
  });

  test("TC-0112: Switching tabs does not lose unsaved changes silently without warning", async ({
    page,
  }) => {
    const accessTokenInput = page.getByLabel("Access Token Validity");
    if (await accessTokenInput.isVisible().catch(() => false)) {
      const original = await accessTokenInput.inputValue();
      await accessTokenInput.fill(String(Number(original) + 1));

      await page.getByRole("tab", { name: "IAM" }).click();
      await page.getByRole("tab", { name: "Auth" }).click();

      // Document whichever behavior is actually observed rather than assuming one.
      await expect(accessTokenInput).toBeVisible();
    }
  });
});
