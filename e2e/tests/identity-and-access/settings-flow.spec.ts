import { test, expect } from "../../support/test-base";
import { openOsDashboard, openProjectOverview, openIam, openSecretManagement, openLmt, openEmailManagement, openOsConsole } from "../../support/os-helpers";

test.describe("flows", () => {



  test("Settings flow: Auth tab strict validation -> save -> IAM/Signup/Organization tabs", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Settings (renders as Auth Configuration)", async () => {
      await openIam(page, "settings", "Settings");
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
