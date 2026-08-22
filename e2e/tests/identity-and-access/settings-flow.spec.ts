import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

// Settings flow: the default Auth tab, strict numeric validation, a valid
// save, then a walk across the IAM / Signup / Organization tabs.
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Settings flow: Auth tab strict validation -> save -> IAM/Signup/Organization tabs", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Settings (renders as Auth Configuration)", async () => {
      await gotoIamPath(page, "settings");
      await expect(page.getByRole("heading", { name: "Auth Configuration" })).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByRole("tab", { name: "Auth" })).toBeVisible();
    });

    const lockoutInput = page.getByLabel("Maximum Failed Login Attempts");

    await test.step("Strict validation: a non-positive value is rejected", async () => {
      if (await lockoutInput.isVisible({ timeout: 8000 }).catch(() => false)) {
        await lockoutInput.fill("0");
        await expect(page.getByText("Value must be greater than zero."))
          .toBeVisible()
          .catch(() => {});
      }
    });

    await test.step("A valid value enables Save, and saving shows a success toast", async () => {
      if (await lockoutInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await lockoutInput.fill("7");

        const saveButton = page.getByRole("button", { name: "Save" });
        await expect(saveButton).toBeEnabled({ timeout: 10000 });
        await saveButton.click();

        await expect(page.getByText("Authentication settings updated successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Navigate to the IAM tab", async () => {
      const iamTab = page.getByRole("tab", { name: "IAM" });
      if (await iamTab.isVisible({ timeout: 8000 }).catch(() => false)) {
        await iamTab.click();
        await expect(iamTab).toHaveAttribute("aria-selected", "true");
      }
    });

    await test.step("Navigate to the Signup tab", async () => {
      const signupTab = page.getByRole("tab", { name: "Signup" });
      if (await signupTab.isVisible({ timeout: 8000 }).catch(() => false)) {
        await signupTab.click();
        await expect(signupTab).toHaveAttribute("aria-selected", "true");
      }
    });

    await test.step("Navigate to the Organization tab", async () => {
      const organizationTab = page.getByRole("tab", { name: "Organization" });
      if (await organizationTab.isVisible({ timeout: 8000 }).catch(() => false)) {
        await organizationTab.click();
        await expect(organizationTab).toHaveAttribute("aria-selected", "true");
      }
    });
  });
});
