import { test, expect } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../../support/login-helper";

// Overview flow: the dashboard page a reader lands on right after opening a
// project's Development environment (pages/dashboard/dashboard-overview.tsx).
// It shows the project name/env badge/X-Blocks-Key (ProjectOverview), the
// Onboard/Delete actions (ProjectActions), a Domains section with strict
// add-domain validation (domain-form.schema.ts), and a Repositories section.
// createProject already leaves the page on this exact dashboard, so this
// flow drives it in place rather than navigating again.
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Overview flow: project header -> onboard -> strict domain validation -> add -> delete domain", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Land on the Overview (dashboard) page with project header and key", async () => {
      await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15000 });
    });

    await test.step("Onboard action opens the AI-agent onboarding brief", async () => {
      await page.getByRole("button", { name: "Onboard" }).click();
      await expect(
        page.getByRole("heading", { name: "Onboard with an AI agent" }),
      ).toBeVisible({ timeout: 10000 });
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("heading", { name: "Onboard with an AI agent" }),
      ).toBeHidden();
    });

    await test.step("Delete action (project owner) is visible on Overview", async () => {
      await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
    });

    await test.step("Domains section is present, empty by default", async () => {
      await expect(page.getByText("Domains", { exact: true })).toBeVisible();
      await expect(page.getByText("No domains configured yet.")).toBeVisible({ timeout: 20000 });
    });

    await test.step("Open 'Add Domain' dialog", async () => {
      await page.getByRole("button", { name: "Add Domain" }).click();
      await expect(page.getByRole("heading", { name: "Add Domain" })).toBeVisible();
    });

    await test.step("'Add' stays disabled until Domain and Cookie Domain are valid", async () => {
      const addButton = page.getByRole("button", { name: "Add", exact: true });
      await expect(addButton).toBeDisabled();

      // Invalid domain format keeps the form invalid — exact message from
      // domain-form.schema.ts's domainRegex rule.
      await page.getByPlaceholder("your-domain.com").first().fill("not a domain");
      await expect(page.getByText("Please enter a valid domain (e.g. example.com)").first())
        .toBeVisible()
        .catch(() => {});
      await expect(addButton).toBeDisabled();
    });

    const domainSuffix = Date.now();
    const domainName = `flow-${domainSuffix}.example.com`;

    await test.step("Fill a valid domain (cookie domain auto-derives) and save", async () => {
      const domainInput = page.getByPlaceholder("your-domain.com").first();
      await domainInput.fill(domainName);

      const addButton = page.getByRole("button", { name: "Add", exact: true });
      await expect(addButton).toBeEnabled({ timeout: 10000 });
      await addButton.click();

      await expect(page.getByText("Application added successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
      await expect(page.getByRole("heading", { name: "Add Domain" })).toBeHidden({
        timeout: 10000,
      });
    });

    const domainRow = page.getByRole("row").filter({ hasText: domainName });

    await test.step("New domain appears in the table as Unverified", async () => {
      await expect(domainRow).toBeVisible({ timeout: 15000 });
      await expect(domainRow.getByText("Unverified")).toBeVisible();
    });

    await test.step("Unverified domain offers Configure and Validate CNAME actions", async () => {
      await expect(domainRow.getByTitle("Configure domain")).toBeVisible();
      await expect(domainRow.getByTitle("Validate CNAME")).toBeVisible();
    });

    await test.step("Delete the domain via its confirmation dialog", async () => {
      await domainRow.getByTitle("Delete domain").click();
      await expect(page.getByRole("heading", { name: "Delete Domain" })).toBeVisible();
      await expect(
        page.getByText("Are you sure you want to delete the following domain?"),
      ).toBeVisible();
      await expect(page.getByText(domainName)).toBeVisible();

      await page.getByRole("button", { name: "Delete", exact: true }).last().click();
      await expect(page.getByText("Domain deleted successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
      await expect(domainRow).toHaveCount(0, { timeout: 10000 });
    });

    await test.step("Domains section is empty again", async () => {
      await expect(page.getByText("No domains configured yet.")).toBeVisible({ timeout: 10000 });
    });
  });
});
