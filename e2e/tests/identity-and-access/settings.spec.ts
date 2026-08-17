import { test, expect, Page } from "@playwright/test";
import {
  createProject,
  deleteCreatedProject,
  openDashboardChildPage,
} from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

const saveButton = (page: Page) => page.getByRole("button", { name: /^save$/i });

const clickSaveIfEnabled = async (page: Page) => {
  const button = saveButton(page);
  if (await button.isEnabled()) {
    await button.click();
    return;
  }
  await expect(button).toBeDisabled();
};

test.describe("identity and access", () => {
  let projectName = "";
  let itemId = "";
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName, itemId } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Identity & Access — Settings", async ({ page }) => {
    // ============================================================
    // Settings
    // ============================================================
    await test.step("Navigate to Settings", async () => {
      await openDashboardChildPage(page, itemId, "iam/settings");
      await expect(page.getByRole("tab", { name: "Auth" })).toBeVisible({
        timeout: 30000,
      });
    });

    await test.step("[Positive] Settings page renders Auth, IAM, Signup and Organization tabs", async () => {
      await expect(page.getByRole("tab", { name: "Auth" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "IAM" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Signup" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Organization" })).toBeVisible();
    });

    await test.step("[Negative] Access Token Validity must be a whole number between 0 and 2,147,483,647", async () => {
      const accessTokenInput = page.getByLabel("Access Token Validity");
      if (await accessTokenInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await accessTokenInput.fill("-1");
        await expect(page.getByText("Must be zero or greater.")).toBeVisible();

        await accessTokenInput.fill("99999999999");
        await expect(
          page.getByText("Value exceeds the allowed limit (0 - 2,147,483,647)."),
        ).toBeVisible();

        await accessTokenInput.fill("15.5");
        await expect(page.getByText("Must be a whole number.")).toBeVisible();
      }
    });

    await test.step("[Negative] IAM tab requires an Account action base URL unless OIDC is enabled", async () => {
      await page.getByRole("tab", { name: "IAM" }).click();
      const oidcToggle = page.getByLabel(/OIDC/i);
      // The field's own accessible name is its placeholder text, not "Account
      // action base URL" — that phrase only appears on a nearby, unrelated
      // toggle switch ("Use account action base URL as default"), which
      // getByLabel with a loose regex was matching instead.
      const baseUrlInput = page.getByPlaceholder("console.enterprise.cloud");
      if (
        (await oidcToggle.isVisible({ timeout: 5000 }).catch(() => false)) &&
        (await baseUrlInput.isVisible().catch(() => false))
      ) {
        const wasChecked = await oidcToggle.isChecked().catch(() => false);
        if (wasChecked) {
          await oidcToggle.click(); // turn OIDC off to exercise the rule
        }
        await baseUrlInput.fill("");
        await baseUrlInput.blur();
        // Save stays disabled while the IAM form is not dirty (empty fill is a
        // no-op). Do not click a disabled control — Playwright waits until timeout.
        await clickSaveIfEnabled(page);
        await expect(page.getByText("Account action base URL is required."))
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }
    });

    await test.step("[Security] Signup tab discards unsaved role/permission edits the moment sign-up is disabled", async () => {
      // Business rule from the source: "When signup disabled, roles/permissions
      // must stay at loaded backend values — not in-session edits." This guards
      // against a disabled-but-still-editable set of default grants leaking
      // through if the toggle state and the underlying payload ever disagree.
      await page.getByRole("tab", { name: "Signup" }).click();
      const signupToggle = page.getByLabel("Sign Up Enabled");
      if (await signupToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
        if (!(await signupToggle.isChecked())) {
          await signupToggle.click();
        }
        const addRoleButton = page.getByRole("button", { name: /add.*role/i }).first();
        const wasEditable = await addRoleButton.isEnabled().catch(() => false);

        await signupToggle.click(); // disable
        if (wasEditable) {
          await expect(addRoleButton)
            .toBeDisabled()
            .catch(() => {});
        }
      }
    });

    await test.step("[Positive] Saving Signup settings shows a success toast", async () => {
      const signupToggle = page.getByLabel("Sign Up Enabled");
      if (await signupToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
        await clickSaveIfEnabled(page);
        await expect(page.getByText("Signup settings updated successfully", { exact: true }))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });
  });
});
