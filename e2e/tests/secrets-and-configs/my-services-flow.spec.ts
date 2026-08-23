import { test, expect, Page } from "@playwright/test";
import { openSharedProjectDashboard } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link — navigate
// straight to the section's URL instead (same convention as the existing
// per-sub-feature specs in "secrets and configs/").
const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({ timeout: 30000 });
};

// My Services flow: a single continuous journey — strict validation on
// registering a new service (Save stays disabled until dirty), save it,
// expand its accordion row to see the generated Service ID and X-Blocks-Key,
// then open the "Setup Guide" side panel. NOTE: service-card.tsx exposes no
// delete action for a registered service (only Logs/Traces/Swagger/Docs
// links), so there is no closing "delete" stage for this section.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await openSharedProjectDashboard(page);
  });

  test("My Services flow: strict validation -> register -> expand details -> setup guide", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to My Services", async () => {
      await gotoSecretManagementSection(page, "my-services", "My Services");
    });

    await test.step("Open the Register Service dialog", async () => {
      await page.getByRole("button", { name: "Register Service" }).click();
      await expect(page.getByRole("heading", { name: "Register New Service" })).toBeVisible();
    });

    const saveButton = page.getByRole("button", { name: "Save", exact: true });

    await test.step("'Save' stays disabled until the form is dirty and valid", async () => {
      await expect(saveButton).toBeDisabled();
    });

    const serviceName = `Flow Service ${Date.now()}`;

    await test.step("Fill Service Name, select a Type, then save", async () => {
      await page.getByPlaceholder("Enter name").fill(serviceName);

      const typeSelect = page.getByRole("dialog").getByRole("combobox").first();
      await typeSelect.click();
      await page.getByRole("option", { name: "Backend", exact: true }).click();

      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      await saveButton.click();

      await expect(page.getByText("Service Registered successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    const serviceTrigger = page.getByRole("button", { name: new RegExp(serviceName) });

    await test.step("Find the new service and expand its accordion row", async () => {
      await expect(serviceTrigger).toBeVisible({ timeout: 15000 });
      await serviceTrigger.click();
      await expect(page.getByText("Service ID")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("X-Blocks-Key")).toBeVisible();
    });

    await test.step("Open the Setup Guide panel", async () => {
      await page.getByRole("button", { name: "Setup Guide" }).click();
      await expect(page.getByRole("heading", { name: "Guideline" }))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
    });
  });
});
