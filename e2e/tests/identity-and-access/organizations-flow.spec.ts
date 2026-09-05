import { test, expect } from "../../support/test-base";
import { openIam } from "../../support/os-helpers";
import { refreshSuiteSession } from "../../support/session-lifecycle";

// Organizations flow — verified against live Playwright CLI snapshots:
//   snapshots/organizations.yml
//   snapshots/organizations-add-dialog.yml
//   snapshots/organizations-add-validation.yml (click Add → "Name must be at most 100 characters")
//   snapshots/organizations-add-after-submit.yml (POST …/create → 403, dialog stays open)
//
// Do NOT soft-skip create. An empty-body 403 may show no toast on the deployed
// app; the reliable failure signal is the HTTP status (+ dialog still open).
// Max-length FormMessage only appears after Add (RHF default onSubmit mode).
test.describe("flows", () => {

  test("Organizations flow: strict validation -> create -> select in sidebar -> workspace panel", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Enable Multi-Organization via Configure Organization", async () => {
      // Snapshot shows header action → iam/settings?settingsTab=organization-config
      await openIam(page, "organization", "Organizations");
      const configure = page.getByRole("button", { name: "Configure Organization" });
      await expect(configure).toBeVisible({ timeout: 20000 });
      await configure.click();
      await expect(page).toHaveURL(/iam\/settings.*organization-config/, { timeout: 15000 });

      const multiOrgSwitch = page.getByLabel("Multi-Organization Environment");
      await expect(multiOrgSwitch).toBeVisible({ timeout: 20000 });
      if (!(await multiOrgSwitch.isChecked())) {
        await multiOrgSwitch.click();
        await expect(
          page.getByRole("heading", { name: "Enable multi-organization mode?" }),
        ).toBeVisible({ timeout: 10000 });
        await page.getByRole("button", { name: "Enable", exact: true }).click();
        await expect(multiOrgSwitch).toBeChecked({ timeout: 10000 });
      }

      // Add Organization is gated on allowCreationFromCloud (add-organization.tsx).
      const cloudWorkflowSwitch = page.getByLabel("Allow Creation from OS");
      await expect(cloudWorkflowSwitch).toBeVisible({ timeout: 15000 });
      if (!(await cloudWorkflowSwitch.isChecked())) {
        await cloudWorkflowSwitch.click();
        const saveButton = page.getByRole("button", { name: "Save" });
        await expect(saveButton).toBeEnabled({ timeout: 10000 });
        await saveButton.click();
        await expect(
          page.getByText("Organization configuration updated successfully", { exact: true }),
        ).toBeVisible({ timeout: 15000 });
      }
    });

    const addOrganizationButton = page.getByRole("button", { name: "Add Organization" });

    await test.step("Organizations page exposes an enabled Add Organization control", async () => {
      await openIam(page, "organization", "Organizations");
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByRole("button", { name: "Configure Organization" })).toBeVisible();
      await expect(page.getByPlaceholder("Search organizations...").first()).toBeVisible({
        timeout: 15000,
      });

      const disabledNotice = page.getByText("Multiple Organizations is not enabled");
      if (await disabledNotice.isVisible({ timeout: 2000 }).catch(() => false)) {
        throw new Error(
          "Organizations still shows multi-org disabled after Configure Organization — create cannot be tested.",
        );
      }

      await expect(addOrganizationButton).toBeVisible({ timeout: 20000 });
      await expect(addOrganizationButton).toBeEnabled({ timeout: 20000 });
    });

    await test.step("Strict validation: Name max length is enforced", async () => {
      await addOrganizationButton.click();
      const dialog = page.getByRole("dialog", { name: "Add Organization" });
      await expect(dialog).toBeVisible();
      // Snapshot: textbox "Name" with placeholder Enter organization name
      const nameInput = dialog.getByRole("textbox", { name: "Name" });
      const submitButton = dialog.getByRole("button", { name: "Add", exact: true });
      await expect(nameInput).toBeVisible();

      // RHF + zodResolver default mode is onSubmit — FormMessage appears only
      // after Add is clicked (fill alone does not surface the max-length error).
      await nameInput.fill("a".repeat(101));
      await expect(submitButton).toBeEnabled({ timeout: 5000 });
      await submitButton.click();
      await expect(
        dialog.getByText("Name must be at most 100 characters", { exact: true }),
      ).toBeVisible({ timeout: 5000 });
      await expect(dialog).toBeVisible();
    });

    let orgName = `Flow Org ${Date.now()}`;

    await test.step("Fill a valid name and save — create must succeed (fail hard on 403)", async () => {
      const dialog = page.getByRole("dialog", { name: "Add Organization" });
      const nameInput = dialog.getByRole("textbox", { name: "Name" });
      const submitButton = dialog.getByRole("button", { name: "Add", exact: true });

      const maxAttempts = 2;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await nameInput.fill(orgName);
        await expect(submitButton).toBeEnabled({ timeout: 10000 });

        // Live CLI: POST …/organizations/create → 403, Content-Length 0, dialog stays open.
        // Toast may be absent on the deployed app for empty-body errors — do not
        // require a toast to fail the test.
        const createResponsePromise = page.waitForResponse(
          (response) =>
            /\/api\/iam\/organizations\/create\/?$/i.test(response.url()) &&
            response.request().method() === "POST",
          { timeout: 20000 },
        );

        await submitButton.click();

        const createResponse = await createResponsePromise.catch(() => null);
        const status = createResponse?.status() ?? 0;

        if (status >= 400) {
          const looksLikeAuth = status === 401;
          if (attempt < maxAttempts - 1 && looksLikeAuth) {
            await refreshSuiteSession(page);
            await openIam(page, "organization", "Organizations");
            await expect(addOrganizationButton).toBeEnabled({ timeout: 20000 });
            await addOrganizationButton.click();
            await expect(dialog).toBeVisible({ timeout: 10000 });
            continue;
          }

          await expect(dialog).toBeVisible();
          throw new Error(
            `Add Organization API rejected create with HTTP ${status}. ` +
              `Dialog remained open (see snapshots/organizations-add-after-submit.yml). ` +
              (status === 403
                ? "403 Forbidden is a real permission/policy failure — e2e must fail."
                : "Create must return 2xx for this flow to pass."),
          );
        }

        if (!createResponse) {
          throw new Error(
            "Add Organization click did not produce POST /api/iam/organizations/create — cannot claim create succeeded.",
          );
        }

        const successToast = page.getByText("Organization added successfully", { exact: true });
        const succeeded = await successToast.isVisible({ timeout: 15000 }).catch(() => false);
        if (succeeded) {
          await expect(dialog).toBeHidden({ timeout: 10000 });
          return;
        }

        // 2xx without toast: still require the org row / dialog closed.
        if (await dialog.isVisible().catch(() => false)) {
          throw new Error(
            `Add Organization returned HTTP ${status} but dialog stayed open and no success toast appeared.`,
          );
        }
        await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({
          timeout: 15000,
        });
        return;
      }
    });

    await test.step("Select the new organization in the sidebar and open its workspace panel", async () => {
      const orgEntry = page.getByText(orgName, { exact: true });
      await expect(orgEntry).toBeVisible({ timeout: 15000 });
      await orgEntry.click();
      await expect(page.getByText(orgName, { exact: true }).last()).toBeVisible({ timeout: 15000 });
    });

    await test.step("Members tab shows the member count and an Invite action", async () => {
      const membersTab = page.getByRole("tab", { name: /Members/ });
      await membersTab.click();
      await expect(membersTab).toHaveAttribute("data-state", "active");
      await expect(page.getByRole("button", { name: /Invite/i })).toBeVisible({ timeout: 10000 });
      await page.getByRole("tab", { name: "Details" }).click();
    });

    await test.step("Rename the organization via the '⋮' menu", async () => {
      await page.getByRole("button").filter({ has: page.locator("svg.lucide-ellipsis-vertical") }).click();
      await page.getByRole("menuitem", { name: "Rename" }).click();
      await expect(page.getByRole("heading", { name: "Rename Organization" })).toBeVisible();

      const renamedOrgName = `${orgName} Renamed`;
      const nameInput = page.getByRole("textbox", { name: "Name" });
      await nameInput.fill(renamedOrgName);
      await page.getByRole("button", { name: "Save", exact: true }).click();

      await expect(page.getByText("Organization renamed successfully", { exact: true })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText(renamedOrgName, { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });
      orgName = renamedOrgName;
    });

    await test.step("Disable then re-enable the organization via the '⋮' menu", async () => {
      await page.getByRole("button").filter({ has: page.locator("svg.lucide-ellipsis-vertical") }).click();
      await page.getByRole("menuitem", { name: "Disable" }).click();
      await expect(page.getByRole("heading", { name: "Disable Organization" })).toBeVisible();
      await page.getByRole("button", { name: "Disable", exact: true }).click();
      await expect(page.getByText("Organization disabled successfully", { exact: true })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText("Disabled").first()).toBeVisible({ timeout: 10000 });

      await page.getByRole("button").filter({ has: page.locator("svg.lucide-ellipsis-vertical") }).click();
      await page.getByRole("menuitem", { name: "Enable" }).click();
      await expect(page.getByRole("heading", { name: "Enable Organization" })).toBeVisible();
      await page.getByRole("button", { name: "Enable", exact: true }).click();
      await expect(page.getByText("Organization enabled successfully", { exact: true })).toBeVisible({
        timeout: 15000,
      });
    });

    await test.step("Search: below the 3-character minimum shows a hint instead of filtering", async () => {
      const searchInput = page.getByPlaceholder("Search organizations...").first();
      await searchInput.fill("ab");
      await expect(page.getByText("Type at least 3 characters to search")).toBeVisible({
        timeout: 5000,
      });

      await searchInput.fill(orgName);
      await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({
        timeout: 10000,
      });

      await searchInput.fill("no-such-organization-xyz");
      await expect(page.getByText("No organizations found")).toBeVisible({ timeout: 10000 });

      await searchInput.fill("");
      await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({
        timeout: 10000,
      });
    });

    await test.step("Status filter narrows the sidebar list", async () => {
      const filterButton = page.getByRole("button", { name: "Filter organizations" });
      if (await filterButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await filterButton.click();
        await page.getByText("disabled", { exact: true }).click();
        await page.keyboard.press("Escape");
        await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({
          timeout: 10000,
        });
      }
    });
  });
});
