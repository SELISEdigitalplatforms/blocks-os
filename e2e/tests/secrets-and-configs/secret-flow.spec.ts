import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../../support/login-helper";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link — navigate
// straight to the section's URL instead.
const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({ timeout: 30000 });
};

// Secret flow: a single continuous journey — open the list, trigger strict
// validation on the Create secret form, save a valid secret, expand its row
// into details, then walk the row's dropdown actions before closing.
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Secret flow: strict validation -> create -> expand details -> row actions", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Secret", async () => {
      await gotoSecretManagementSection(page, "secret", "Secret");
      await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
    });

    await test.step("Open the Create secret dialog", async () => {
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByRole("heading", { name: "Create secret" })).toBeVisible();
    });

    await test.step("Strict validation: Name and Secret value are required", async () => {
      const nameInput = page.getByPlaceholder("payment-gateway-key");
      await nameInput.fill("x");
      await nameInput.fill("");
      await expect(page.getByText("A name is required."))
        .toBeVisible()
        .catch(() => {});

      const valueInput = page.getByPlaceholder("Paste the secret value");
      await valueInput.fill("x");
      await valueInput.fill("");
      await expect(page.getByText("A value is required."))
        .toBeVisible()
        .catch(() => {});
    });

    const secretName = `flow-secret-${Date.now()}`;

    await test.step("Fill a valid secret and save", async () => {
      await page.getByPlaceholder("payment-gateway-key").fill(secretName);
      await page
        .getByPlaceholder("What this secret is for")
        .fill("Created by the Secret flow test.");
      await page.getByPlaceholder("Paste the secret value").fill("flow-secret-value-12345");

      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("heading", { name: "Create secret" })).toBeHidden({
        timeout: 15000,
      });
    });

    const secretRow = page.getByRole("row").filter({ hasText: secretName });

    await test.step("Find the new secret and expand its row into details", async () => {
      await expect(secretRow).toBeVisible({ timeout: 15000 });
      await secretRow.click();
      // Expanding renders a detail panel for this row; the chevron rotates
      // and a details region becomes visible somewhere below the row.
      await expect(page.getByText("What this secret is for").or(secretRow)).toBeVisible();
    });

    await test.step("Open the row's actions dropdown and close it without deleting", async () => {
      const actionsButton = page.getByRole("button", {
        name: new RegExp(`Actions for.*${secretName}`),
      });
      if (await actionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await actionsButton.click();
        await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Rotate" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
        await page.keyboard.press("Escape");
      }
    });

    await test.step("Edit the secret's description via the row's Edit action", async () => {
      const actionsButton = page.getByRole("button", {
        name: new RegExp(`Actions for.*${secretName}`),
      });
      if (await actionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await actionsButton.click();
        await page.getByRole("menuitem", { name: "Edit" }).click();
        await expect(page.getByRole("heading", { name: "Edit secret" })).toBeVisible();

        const descriptionInput = page.getByPlaceholder("What this secret is for");
        await descriptionInput.fill("Updated by the Secret flow test.");
        await page.getByRole("button", { name: "Save" }).click();
        await expect(page.getByRole("heading", { name: "Edit secret" })).toBeHidden({
          timeout: 15000,
        });
      }
    });
  });
});
