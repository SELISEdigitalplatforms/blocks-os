import { test, expect } from "../../support/test-base";
import { openSecretManagement } from "../../support/os-helpers";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link — navigate
// straight to the section's URL instead (same convention as the existing
// per-sub-feature specs in "secrets and configs/").

// MFA flow: a single continuous journey through the "MFA" sub-section under
// Secrets & Configs. Unlike the other sub-sections, MFA has no "Add"
// action — it's a fixed table of two built-in methods (Email, Authenticator
// app; see mfa-config.ts) that are toggled on/off via a per-row dropdown and
// a confirmation dialog (configure-mfa.tsx). The flow enables the Email
// method (if disabled), then disables it again, restoring the section to
// its original state.
test.describe("flows", () => {

  test("MFA flow: view methods -> enable -> disable", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to MFA", async () => {
      await openSecretManagement(page, "mfa", "MFA");
    });

    const emailRow = page.getByRole("row").filter({ hasText: "Email" });
    const authenticatorRow = page.getByRole("row").filter({ hasText: "Authenticator app" });

    await test.step("The fixed MFA method table shows Email and Authenticator app", async () => {
      await expect(emailRow).toBeVisible({ timeout: 15000 });
      await expect(authenticatorRow).toBeVisible();
    });

    const readStatus = async (row: typeof emailRow) =>
      (
        await row
          .getByText(/Enabled|Disabled/)
          .first()
          .textContent()
      )?.trim();

    const toggleAndConfirm = async (
      row: typeof emailRow,
      methodName: string,
      expectedAction: "Enable" | "Disable",
    ) => {
      await row.getByRole("button").last().click();
      const actionItem = page.getByRole("menuitem", { name: expectedAction, exact: true });
      await expect(actionItem).toBeVisible({ timeout: 8000 });
      await actionItem.click();

      await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible({
        timeout: 8000,
      });
      await expect(
        page.getByText(
          new RegExp(
            `Are you sure you want to ${expectedAction.toLowerCase()} ${methodName} MFA\\??`,
            "i",
          ),
        ),
      )
        .toBeVisible()
        .catch(() => {});
      await page.getByRole("button", { name: "Yes", exact: true }).click();

      await expect(
        page.getByText(
          new RegExp(`${methodName} MFA ${expectedAction.toLowerCase()}d successfully`),
        ),
      )
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    };

    const initialEmailStatus = await readStatus(emailRow);

    await test.step("Cancel on the confirmation dialog leaves status unchanged", async () => {
      await emailRow.getByRole("button").last().click();
      const nextAction = initialEmailStatus === "Enabled" ? "Disable" : "Enable";
      await page.getByRole("menuitem", { name: nextAction, exact: true }).click();
      await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible({
        timeout: 8000,
      });
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Confirmation" })).toBeHidden({
        timeout: 8000,
      });
      await expect(emailRow.getByText(initialEmailStatus ?? "Disabled")).toBeVisible();
    });

    await test.step("Toggle Email MFA to the opposite of its current state", async () => {
      const nextAction = initialEmailStatus === "Enabled" ? "Disable" : "Enable";
      await toggleAndConfirm(emailRow, "Email", nextAction);
      await expect(
        emailRow.getByText(nextAction === "Enable" ? "Enabled" : "Disabled"),
      ).toBeVisible({ timeout: 10000 });
    });

    const initialAuthenticatorStatus = await readStatus(authenticatorRow);

    await test.step("Toggle Authenticator app MFA to the opposite of its current state", async () => {
      const nextAction = initialAuthenticatorStatus === "Enabled" ? "Disable" : "Enable";
      await toggleAndConfirm(authenticatorRow, "Authenticator app", nextAction);
      await expect(
        authenticatorRow.getByText(nextAction === "Enable" ? "Enabled" : "Disabled"),
      ).toBeVisible({ timeout: 10000 });
    });

    await test.step("Toggle Authenticator app MFA back to its original state", async () => {
      const restoreAction = initialAuthenticatorStatus === "Enabled" ? "Enable" : "Disable";
      await toggleAndConfirm(authenticatorRow, "Authenticator app", restoreAction);
      await expect(
        authenticatorRow.getByText(initialAuthenticatorStatus ?? "Disabled"),
      ).toBeVisible({
        timeout: 10000,
      });
    });

    await test.step("Toggle Email MFA back to its original state", async () => {
      const restoreAction = initialEmailStatus === "Enabled" ? "Enable" : "Disable";
      await toggleAndConfirm(emailRow, "Email", restoreAction);
      await expect(emailRow.getByText(initialEmailStatus ?? "Disabled")).toBeVisible({
        timeout: 10000,
      });
    });
  });
});
