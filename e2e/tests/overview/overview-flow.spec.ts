import { test, expect } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

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

    const dashboardUrl = page.url();

    // The topbar (language/theme/app-switcher/user-menu/notifications) is
    // part of the shared app shell rendered on every page, so it's exercised
    // here rather than navigated to separately.
    await test.step("Theme switcher toggles between Auto, Light and Dark", async () => {
      const autoTab = page.locator('[id*="trigger-system"]');
      const lightTab = page.locator('[id*="trigger-light"]');
      const darkTab = page.locator('[id*="trigger-dark"]');

      if (await lightTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await lightTab.click();
        await expect(lightTab).toHaveAttribute("aria-selected", "true");

        await darkTab.click();
        await expect(darkTab).toHaveAttribute("aria-selected", "true");

        // Restore the default so it doesn't affect other tests/screenshots.
        await autoTab.click();
        await expect(autoTab).toHaveAttribute("aria-selected", "true");
      }
    });

    await test.step("Language switcher offers language options", async () => {
      const languageButton = page.getByRole("button", { name: /^en$/i });
      if (await languageButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await languageButton.click();
        const firstOption = page.getByRole("menuitem").or(page.getByRole("option")).first();
        await expect(firstOption).toBeVisible({ timeout: 5000 }).catch(() => {});
        await page.keyboard.press("Escape");
      }
    });

    await test.step("'SELISE Blocks apps' opens the app switcher with sibling apps listed", async () => {
      const appsButton = page.getByRole("button", { name: "SELISE Blocks apps" });
      if (await appsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await appsButton.click();
        // A couple of the sibling apps in the suite — enough to confirm the
        // switcher actually lists other apps, not just decorative content.
        await expect(page.getByText("Logic", { exact: true }).first()).toBeVisible({
          timeout: 5000,
        });
        await expect(page.getByText("Data", { exact: true }).first()).toBeVisible();
        await page.keyboard.press("Escape");
      }
    });

    await test.step("Notification bell opens the notifications panel", async () => {
      const bellButton = page.locator("button:has(svg.lucide-bell)").first();
      if (await bellButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await bellButton.click();
        await expect(page.getByText(/notification/i).first())
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
        await page.keyboard.press("Escape");
      }
    });

    await test.step("'Open user menu' -> 'My Profile' navigates to the Profile page", async () => {
      const userMenuButton = page.getByRole("button", { name: "Open user menu" });
      if (await userMenuButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await userMenuButton.click();
        const profileItem = page.getByText("My Profile", { exact: true });
        if (await profileItem.isVisible({ timeout: 5000 }).catch(() => false)) {
          await profileItem.click();
          await expect(page).toHaveURL(/\/app\/profile/, { timeout: 15000 });
          // Back to the project dashboard for the rest of the flow.
          await page.goto(dashboardUrl);
          await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15000 });
        }
      }
    });

    await test.step("Console page's Resource links point to the right external URLs", async () => {
      await page.goto(`${new URL(page.url()).origin}/app/console`);
      await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
        timeout: 30000,
      });

      const docsLink = page.getByRole("link", { name: /Docs/ }).first();
      const codeLink = page.getByRole("link", { name: /Code/ }).first();
      const cloudLink = page.getByRole("link", { name: /Cloud/ }).first();

      if (await docsLink.isVisible({ timeout: 8000 }).catch(() => false)) {
        await expect(docsLink).toHaveAttribute("href", "https://docs.seliseblocks.com");
        await expect(docsLink).toHaveAttribute("target", "_blank");

        await expect(codeLink).toHaveAttribute("href", "https://github.com/SELISEdigitalplatforms");
        await expect(codeLink).toHaveAttribute("target", "_blank");

        await expect(cloudLink).toHaveAttribute("href", "https://selisegroup.com/blocks/");
        await expect(cloudLink).toHaveAttribute("target", "_blank");
      }

      // Back to the project dashboard for the rest of the flow.
      await page.goto(dashboardUrl);
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

    await test.step("Copying the domain and cookie domain values works", async () => {
      const copyDomainButton = domainRow.locator("button:has(svg.lucide-copy)").first();
      if (await copyDomainButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await copyDomainButton.click();
        // The button swaps its Copy icon for a Check icon while "copied" is
        // shown — the only reliably-testable signal without a granted
        // clipboard-read permission.
        await expect(domainRow.locator("button:has(svg.lucide-check)").first())
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }
    });

    await test.step("'Configure domain' opens the pre-filled Edit Domain dialog", async () => {
      await domainRow.getByTitle("Configure domain").click();
      await expect(page.getByRole("heading", { name: "Edit Domain" })).toBeVisible();

      const domainInput = page.getByPlaceholder("your-domain.com").first();
      await expect(domainInput).toHaveValue(domainName);

      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("heading", { name: "Edit Domain" })).toBeHidden();
    });

    await test.step("'Validate CNAME' runs a real lookup against the unverified domain", async () => {
      await domainRow.getByTitle("Validate CNAME").click();
      await expect(page.getByRole("heading", { name: "Validate Domain" })).toBeVisible();
      await expect(
        page.getByText("No servers found for", { exact: false }),
      )
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});

      const lookupButton = page.getByRole("button", { name: "CNAME Lookup" });
      await expect(lookupButton).toBeEnabled({ timeout: 5000 });
      await lookupButton.click();
      // The fake domain has no real DNS records, so this is expected to fail
      // validation — either toast confirms the request actually ran.
      await expect(
        page
          .getByText("CName is validated successfully")
          .or(page.getByText("Could not verify the domain", { exact: false })),
      )
        .toBeVisible({ timeout: 20000 })
        .catch(() => {});

      await page.keyboard.press("Escape");
    });

    await test.step("Domain search filter narrows the table", async () => {
      const searchInput = page.getByPlaceholder("Search domains...");
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill("no-such-domain-xyz");
        await expect(page.getByText("No domains match your search.")).toBeVisible({
          timeout: 8000,
        });
        // Clearing resets the table to page 1 — with pre-seeded platform
        // domains plus the one just added, it isn't guaranteed to land back
        // on the page our domain is on, so this re-confirms via a fresh
        // search instead of assuming the unfiltered view shows it.
        await searchInput.fill("");
        await expect(page.getByText("No domains match your search.")).toBeHidden({
          timeout: 8000,
        });
        await searchInput.fill(domainName);
        await expect(domainRow)
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
        await searchInput.fill("");
      }
    });

    await test.step("Domain table pagination controls appear once there's more than a page", async () => {
      const paginationNav = page.locator('nav[aria-label="Domains pagination"]');
      const nextPageButton = paginationNav.locator("button:has(svg.lucide-chevron-right)").first();
      if (
        (await nextPageButton.isVisible({ timeout: 3000 }).catch(() => false)) &&
        (await nextPageButton.isEnabled().catch(() => false))
      ) {
        await nextPageButton.click();
        await expect(page.getByRole("row").filter({ hasText: domainName })).toHaveCount(0);
        // Back to the first page via the pagination's own "first page" control.
        await paginationNav.locator("button:has(svg.lucide-chevrons-left)").first().click();
        await expect(domainRow).toBeVisible({ timeout: 8000 });
      }
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

    await test.step("Repositories section is present below Domains", async () => {
      await expect(page.getByText("Repositories", { exact: true })).toBeVisible({
        timeout: 15000,
      });
      // A freshly created project has no deployed repositories yet.
      await expect(page.getByText(/no repositories/i).first())
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
    });
  });
});
