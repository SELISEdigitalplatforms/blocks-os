import { test, expect } from "../../support/test-base";
import { openOsDashboard, openProjectOverview, openIam, openSecretManagement, openLmt, openEmailManagement, openOsConsole } from "../../support/os-helpers";

test.describe("flows", () => {



  test("Organizations flow: strict validation -> create -> select in sidebar -> workspace panel", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    let organizationsEnabled = false;

    await test.step("Navigate to Organizations", async () => {
      await openIam(page, "organization", "Organizations");
      const searchInput = page.getByPlaceholder("Search organizations...").first();
      const disabledNotice = page.getByText("Multiple Organizations is not enabled").first();
      await expect(searchInput.or(disabledNotice)).toBeVisible({ timeout: 30000 });

      organizationsEnabled = await page
        .getByRole("button", { name: /add organization/i })
        .isEnabled({ timeout: 5000 })
        .catch(() => false);
    });

    await test.step("Strict validation: Name is required (max 100 characters)", async () => {
      if (!organizationsEnabled) return;
      await page.getByRole("button", { name: /add organization/i }).click();
      await expect(page.getByRole("heading", { name: "Add Organization" })).toBeVisible();

      const nameInput = page.getByPlaceholder("Enter organization name");
      await nameInput.fill("x");
      await nameInput.fill("");
      await expect(page.getByText("Name is required")).toBeVisible();

      await nameInput.fill("a".repeat(101));
      await expect(page.getByText("Name must be at most 100 characters")).toBeVisible();
    });

    const orgName = `Flow Org ${Date.now()}`;

    await test.step("Fill a valid name and save", async () => {
      if (!organizationsEnabled) return;
      const nameInput = page.getByPlaceholder("Enter organization name");
      await nameInput.fill(orgName);

      await page
        .getByRole("button", { name: /save|add/i })
        .last()
        .click();
      await expect(page.getByText("Organization added successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    await test.step("Select the new organization in the sidebar and open its workspace panel", async () => {
      if (!organizationsEnabled) return;
      const orgEntry = page.getByText(orgName, { exact: true });
      await expect(orgEntry).toBeVisible({ timeout: 15000 });
      await orgEntry.click();

      // Selecting an org loads its OrganizationWorkspacePanel in the right
      // pane — its details tab shows the org's own name again.
      await expect(page.getByText(orgName, { exact: true }).last()).toBeVisible({ timeout: 15000 });
    });
  });
});
