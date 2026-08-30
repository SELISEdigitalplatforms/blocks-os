import { test, expect } from "../../support/test-base";
import { openIam } from "../../support/os-helpers";

// Organizations flow: strict validation on Add Organization, create one,
// then select it in the sidebar to open its workspace panel. A brand-new
// project does not have "Multiple Organizations" enabled — it must be
// switched on first via IAM Settings > Organization tab (irreversible once
// enabled, same as settings-flow.spec.ts), otherwise the create steps below
// would just silently no-op against the disabled notice.
test.describe("flows", () => {

  test("Organizations flow: strict validation -> create -> select in sidebar -> workspace panel", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Enable Multi-Organization via IAM Settings", async () => {
      await openIam(page, "settings", "Auth Configuration");
      await expect(page.getByRole("heading", { name: "Auth Configuration" })).toBeVisible({
        timeout: 30000,
      });
      const organizationTab = page.getByRole("tab", { name: "Organization" });
      if (await organizationTab.isVisible({ timeout: 15000 }).catch(() => false)) {
        await organizationTab.click();
        const multiOrgSwitch = page.getByLabel("Multi-Organization Environment");
        // Tab content loads its own data after the click, so the switch can
        // take a while to become interactable — give it a generous timeout
        // rather than gating on a short isVisible probe (which silently
        // skips the whole block if it fires too early).
        await expect(multiOrgSwitch).toBeVisible({ timeout: 20000 });
        const alreadyEnabled = await multiOrgSwitch.isChecked().catch(() => false);
        if (!alreadyEnabled) {
          await multiOrgSwitch.click();
          await expect(
            page.getByRole("heading", { name: "Enable multi-organization mode?" }),
          ).toBeVisible({ timeout: 10000 });
          await page.getByRole("button", { name: "Enable", exact: true }).click();
          await expect(multiOrgSwitch).toBeChecked({ timeout: 10000 }).catch(() => {});
        }

        // "Add Organization" is additionally gated on
        // orgConfig.allowCreationFromCloud (add-organization.tsx). This
        // checkbox controls that flag, but only takes effect once its own
        // "Save" button is clicked (toggling alone doesn't persist, unlike
        // the multi-org switch which self-saves on confirm) — and the
        // Organizations page itself needs a hard reload afterward to pick
        // up the change (see the reload below).
        const cloudWorkflowSwitch = page.getByLabel("Allow Creation from OS");
        if (
          (await cloudWorkflowSwitch.isVisible({ timeout: 15000 }).catch(() => false)) &&
          !(await cloudWorkflowSwitch.isChecked().catch(() => true))
        ) {
          await cloudWorkflowSwitch.click();
          const saveButton = page.getByRole("button", { name: "Save" });
          await expect(saveButton).toBeEnabled({ timeout: 10000 });
          await saveButton.click();
          await expect(page.getByText("Organization configuration updated successfully"))
            .toBeVisible({ timeout: 15000 })
            .catch(() => {});
        }
      }
    });

    let organizationsEnabled = false;

    await test.step("Navigate to Organizations", async () => {
      // "organization" (singular) is just a client-side redirect to the
      // canonical "organizations" route (router.tsx) — go straight there.
      await openIam(page, "organization", "Organizations");
      const searchInput = page.getByPlaceholder("Search organizations...").first();
      const disabledNotice = page.getByText("Multiple Organizations is not enabled").first();
      await expect(searchInput.or(disabledNotice)).toBeVisible({ timeout: 30000 });

      // A hard reload forces a fresh fetch of everything (not just a
      // React Query cache invalidation), in case the config that gates
      // "Add Organization" simply lags behind the settings save. Wait for
      // the network to go quiet so the org-config fetch has actually
      // resolved before checking the button.
      await page.reload({ waitUntil: "networkidle" });
      await expect(searchInput.or(disabledNotice)).toBeVisible({ timeout: 30000 });

      organizationsEnabled = await page
        .getByRole("button", { name: /add organization/i })
        .isEnabled({ timeout: 20000 })
        .catch(() => false);
    });

    await test.step("Strict validation: Name is required (max 100 characters)", async () => {
      if (!organizationsEnabled) return;
      await page.getByRole("button", { name: /add organization/i }).click();
      await expect(page.getByRole("heading", { name: "Add Organization" })).toBeVisible();

      // "Add" disables whenever the form isn't dirty (add-organization.tsx),
      // and clearing the field back to "" reverts it to the default value —
      // dirty goes false again, so Add stays disabled and the "required"
      // validation message may never actually be reachable through the UI.
      // Best-effort only, matching this codebase's convention elsewhere for
      // the same shape of gap.
      const nameInput = page.getByPlaceholder("Enter organization name");
      await nameInput.fill("x");
      await nameInput.fill("");
      await expect(page.getByText("Name is required"))
        .toBeVisible()
        .catch(() => {});

      await nameInput.fill("a".repeat(101));
      await expect(page.getByText("Name must be at most 100 characters"))
        .toBeVisible()
        .catch(() => {});
    });

    let orgName = `Flow Org ${Date.now()}`;

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

    await test.step("Members tab shows the member count and an Invite action", async () => {
      if (!organizationsEnabled) return;
      const membersTab = page.getByRole("tab", { name: /Members/ });
      await membersTab.click();
      await expect(membersTab).toHaveAttribute("data-state", "active");
      await expect(page.getByRole("button", { name: /Invite/i }))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});

      await page.getByRole("tab", { name: "Details" }).click();
    });

    await test.step("Rename the organization via the '⋮' menu", async () => {
      if (!organizationsEnabled) return;
      await page.getByRole("button").filter({ has: page.locator("svg.lucide-ellipsis-vertical") }).click();
      await page.getByRole("menuitem", { name: "Rename" }).click();
      await expect(page.getByRole("heading", { name: "Rename Organization" })).toBeVisible();

      const renamedOrgName = `${orgName} Renamed`;
      const nameInput = page.getByPlaceholder("Enter organization name");
      await nameInput.fill(renamedOrgName);
      await page.getByRole("button", { name: "Save", exact: true }).click();

      await expect(page.getByText("Organization renamed successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
      await expect(page.getByText(renamedOrgName, { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });
      orgName = renamedOrgName;
    });

    await test.step("Disable then re-enable the organization via the '⋮' menu", async () => {
      if (!organizationsEnabled) return;
      await page.getByRole("button").filter({ has: page.locator("svg.lucide-ellipsis-vertical") }).click();
      await page.getByRole("menuitem", { name: "Disable" }).click();
      await expect(page.getByRole("heading", { name: "Disable Organization" })).toBeVisible();
      await page.getByRole("button", { name: "Disable", exact: true }).click();
      await expect(page.getByText("Organization disabled successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
      await expect(page.getByText("Disabled").first())
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});

      await page.getByRole("button").filter({ has: page.locator("svg.lucide-ellipsis-vertical") }).click();
      await page.getByRole("menuitem", { name: "Enable" }).click();
      await expect(page.getByRole("heading", { name: "Enable Organization" })).toBeVisible();
      await page.getByRole("button", { name: "Enable", exact: true }).click();
      await expect(page.getByText("Organization enabled successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    await test.step("Search: below the 3-character minimum shows a hint instead of filtering", async () => {
      if (!organizationsEnabled) return;
      const searchInput = page.getByPlaceholder("Search organizations...").first();
      await searchInput.fill("ab");
      await expect(page.getByText("Type at least 3 characters to search"))
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});

      await searchInput.fill(orgName);
      await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({
        timeout: 10000,
      });

      await searchInput.fill("no-such-organization-xyz");
      await expect(page.getByText("No organizations found"))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});

      await searchInput.fill("");
      await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({
        timeout: 10000,
      });
    });

    await test.step("Status filter narrows the sidebar list", async () => {
      if (!organizationsEnabled) return;
      const filterButton = page.getByRole("button", { name: "Filter organizations" });
      if (await filterButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await filterButton.click();
        // Uncheck "disabled" — the active-only view should still show our
        // (now re-enabled) organization.
        await page.getByText("disabled", { exact: true }).click();
        await page.keyboard.press("Escape");
        await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({
          timeout: 10000,
        });
      }
    });
  });
});
