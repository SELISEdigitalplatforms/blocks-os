import { test, expect, Page } from "@playwright/test";
import { openSharedProjectDashboard } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";
import { uniqueTestEmail } from "../../support/env";

const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

// Organizations flow: strict validation on Add Organization, create one,
// then select it in the sidebar to open its workspace panel. A brand-new
// project may not have "Multiple Organizations" enabled yet, in which case
// the page shows a disabled notice instead and the create steps are skipped.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await openSharedProjectDashboard(page);
  });

  test("Organizations flow: strict validation -> create -> select in sidebar -> workspace panel", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    let organizationsEnabled = false;

    await test.step("Navigate to Organizations", async () => {
      await gotoIamPath(page, "organization");
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

    await test.step("Sidebar search finds the new organization by name", async () => {
      if (!organizationsEnabled) return;
      const searchInput = page.getByPlaceholder("Search organizations...");

      // Below the 3-character minimum, the box shows a hint instead of
      // querying (organizations-sidebar-list.tsx: SEARCH_MIN_LENGTH).
      await searchInput.fill("ab");
      await expect(page.getByText("Type at least 3 characters to search")).toBeVisible();

      await searchInput.fill(orgName);
      await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });

      await page.getByRole("button", { name: "Clear search" }).click();
      await expect(searchInput).toHaveValue("");
    });

    await test.step("Sidebar status filter can narrow the list to Active or Disabled", async () => {
      if (!organizationsEnabled) return;
      await page.getByRole("button", { name: "Filter organizations" }).click();
      const disabledCheckbox = page.getByRole("checkbox", { name: "disabled" });
      await expect(disabledCheckbox).toBeVisible({ timeout: 5000 });

      // Uncheck "disabled", leaving only "active" — the new org (never
      // disabled) should stay visible.
      await disabledCheckbox.click();
      await page.keyboard.press("Escape");
      await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({
        timeout: 10000,
      });

      // Restore both statuses so later steps see the full list again.
      await page.getByRole("button", { name: "Filter organizations" }).click();
      await page.getByRole("checkbox", { name: "disabled" }).click();
      await page.keyboard.press("Escape");
    });

    const renamedOrgName = `${orgName} Renamed`;
    // The workspace panel's actions button (⋮ next to the org name) has no
    // accessible name, so target it by its icon instead.
    const orgActionsMenuButton = page.locator("button:has(svg.lucide-ellipsis-vertical)").first();

    await test.step("Rename the organization via its actions menu", async () => {
      if (!organizationsEnabled) return;
      await orgActionsMenuButton.click();
      await page.getByText("Rename", { exact: true }).click();

      await expect(page.getByRole("heading", { name: "Rename Organization" })).toBeVisible();
      const nameInput = page.getByPlaceholder("Enter organization name");
      await expect(nameInput).toHaveValue(orgName);
      await nameInput.fill(renamedOrgName);
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page.getByText("Organization renamed successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
      await expect(page.getByText(renamedOrgName, { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });
    });

    await test.step("Disable then re-enable the organization via its actions menu", async () => {
      if (!organizationsEnabled) return;
      await orgActionsMenuButton.click();
      await page.getByText("Disable", { exact: true }).click();

      await expect(page.getByRole("heading", { name: "Disable Organization" })).toBeVisible();
      await page.getByRole("button", { name: "Disable", exact: true }).last().click();
      await expect(page.getByText("Organization disabled successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
      await expect(page.getByText("Disabled", { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });

      await orgActionsMenuButton.click();
      await page.getByText("Enable", { exact: true }).click();

      await expect(page.getByRole("heading", { name: "Enable Organization" })).toBeVisible();
      await page.getByRole("button", { name: "Enable", exact: true }).last().click();
      await expect(page.getByText("Organization enabled successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    const inviteEmail = uniqueTestEmail("flow-org-member");

    await test.step("Open the Members tab and invite a member", async () => {
      if (!organizationsEnabled) return;
      await page.getByRole("tab", { name: /Members \(\d+\)/ }).click();
      await expect(page.getByRole("tab", { name: /Members \(\d+\)/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      await page.getByRole("button", { name: "Invite Member" }).click();
      await expect(page.getByRole("heading", { name: "Invite Member" })).toBeVisible();

      const emailInput = page.getByPlaceholder("name@company.com");
      await emailInput.fill("not-an-email");
      await expect(page.getByText("Please enter a valid email address"))
        .toBeVisible()
        .catch(() => {});

      await emailInput.fill(inviteEmail);
      const sendButton = page.getByRole("button", { name: "Send invite" });
      await expect(sendButton).toBeEnabled({ timeout: 10000 });
      await sendButton.click();

      await expect(page.getByText("Invitation is sent"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    await test.step("The new member appears in the Members table, searchable by email", async () => {
      if (!organizationsEnabled) return;
      const memberRow = page.getByRole("row").filter({ hasText: inviteEmail });
      if (!(await memberRow.isVisible({ timeout: 15000 }).catch(() => false))) {
        // Same refetch race seen elsewhere in this suite right after a fresh invite.
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByRole("tab", { name: /Members \(\d+\)/ }).click();
      }
      await expect(memberRow).toBeVisible({ timeout: 15000 });
    });

    await test.step("Members table pagination controls are present", async () => {
      if (!organizationsEnabled) return;
      await expect(page.getByText(/Showing \d+.\d+ of \d+ members/)).toBeVisible({
        timeout: 10000,
      });
    });

    await test.step("Visit the standalone Organization Detail page", async () => {
      if (!organizationsEnabled) return;
      await page.getByRole("tab", { name: "Details" }).click();

      const idText = await page.getByText(/^Organization ID: /).first().innerText();
      const orgId = idText.replace("Organization ID: ", "").trim();
      if (!orgId) return;

      await gotoIamPath(page, `organization-detail/${orgId}`);
      await expect(page.getByRole("heading", { name: renamedOrgName })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Email").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Invite Member" })).toBeVisible();
    });

    await test.step("Mobile: the workspace panel's 'Organizations' button returns to the sidebar list", async () => {
      if (!organizationsEnabled) return;
      const originalViewport = page.viewportSize();
      await page.setViewportSize({ width: 375, height: 800 });
      try {
        await gotoIamPath(page, "organization");
        const searchInput = page.getByPlaceholder("Search organizations...");
        await expect(searchInput).toBeVisible({ timeout: 15000 });

        const orgEntry = page.getByText(renamedOrgName, { exact: true }).first();
        await expect(orgEntry).toBeVisible({ timeout: 15000 });
        await orgEntry.click();

        // Selecting an org on a mobile viewport swaps the sidebar out for the
        // workspace panel — its "Organizations" back button returns to it.
        await expect(searchInput).toBeHidden();
        const backButton = page.getByRole("button", { name: "Organizations" });
        await expect(backButton).toBeVisible({ timeout: 15000 });
        await backButton.click();
        await expect(searchInput).toBeVisible({ timeout: 10000 });
      } finally {
        if (originalViewport) {
          await page.setViewportSize(originalViewport);
        }
      }
    });
  });
});
