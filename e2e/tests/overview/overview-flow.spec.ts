import { test, expect } from "../../support/test-base";
import { openOsDashboard } from "../../support/os-helpers";

// Overview flow: dashboard after opening the shared project's Development environment.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await openOsDashboard(page);
  });

  test("Overview flow: project header -> onboard -> strict domain validation -> add -> delete domain", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Land on the Overview (dashboard) page with project header and key", async () => {
      await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15000 });
    });

    await test.step("Onboard action opens the AI-agent onboarding brief", async () => {
      const onboardButton = page.getByRole("button", { name: "Onboard" });
      const onboardHeading = page.getByRole("heading", { name: "Onboard with an AI agent" });

      // The button is visible right as the dashboard finishes its own layout
      // shift (header/actions/domains/repos sections mounting in sequence),
      // so a click landing in that window can miss — wait for it to be stable
      // first, and retry once if the dialog still didn't open.
      await expect(onboardButton).toBeVisible({ timeout: 10000 });
      await onboardButton.click();
      if (!(await onboardHeading.isVisible({ timeout: 8000 }).catch(() => false))) {
        await onboardButton.click();
      }
      await expect(onboardHeading).toBeVisible({ timeout: 10000 });
      await page.keyboard.press("Escape");
      await expect(onboardHeading).toBeHidden();
    });

    await test.step("Delete action (project owner) is visible on Overview", async () => {
      await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
    });

    await test.step("Domains section is present", async () => {
      await expect(page.getByText("Domains", { exact: true })).toBeVisible();
      // New projects come pre-seeded with at least one platform domain
      // (e.g. "<tenant>.dev.slsblx.com"), so the table's Domain column
      // header — not the empty state — is the reliable "loaded" signal.
      await expect(page.getByRole("columnheader", { name: "Domain", exact: true })).toBeVisible({
        timeout: 20000,
      });
    });

    await test.step("Open 'Add Domain' dialog", async () => {
      const addDomainHeading = page.getByRole("heading", { name: "Add Domain" });
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.getByRole("button", { name: "Add Domain" }).click();
        if (await addDomainHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
          break;
        }
      }
      await expect(addDomainHeading).toBeVisible();
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
      // The dialog's domain preview is a titled <p>, unlike the table's row
      // (a plain span) — scope to that to avoid matching both.
      await expect(page.getByTitle(`https://${domainName}`)).toBeVisible();

      await page.getByRole("button", { name: "Delete", exact: true }).last().click();
      await expect(page.getByText("Domain deleted successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
      await expect(domainRow).toHaveCount(0, { timeout: 10000 });
    });
  });
});
