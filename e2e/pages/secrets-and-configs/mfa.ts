import { expect, type Page } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

export type MfaMethod = "Email" | "Authenticator app";
export type MfaAction = "Enable" | "Disable";

export async function navigateToMfaFlow(page: Page) {
  await openSecretManagement(page, "mfa", "MFA");
}

export async function getMfaRowFlow(page: Page, method: MfaMethod) {
  const row = page.getByRole("row").filter({ hasText: method });
  await expect(row).toBeVisible({ timeout: 15000 });
  return row;
}

export async function verifyBothMfaMethodsVisibleFlow(
  page: Page,
  emailRow: ReturnType<Page["getByRole"]>,
  authenticatorRow: ReturnType<Page["getByRole"]>,
) {
  await expect(emailRow).toBeVisible();
  await expect(authenticatorRow).toBeVisible();
}

export async function readMfaStatusFlow(row: ReturnType<Page["getByRole"]>): Promise<string> {
  const text = await row.getByText(/Enabled|Disabled/).first().textContent();
  return text?.trim() ?? "";
}

export async function toggleAndConfirmMfaFlow(
  page: Page,
  row: ReturnType<Page["getByRole"]>,
  methodName: MfaMethod,
  action: MfaAction,
) {
  await row.getByRole("button").last().click();
  const actionItem = page.getByRole("menuitem", { name: action, exact: true });
  await expect(actionItem).toBeVisible({ timeout: 8000 });
  await actionItem.click();

  await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible({ timeout: 8000 });
  if (
    await page
      .getByText(
        new RegExp(`Are you sure you want to ${action.toLowerCase()} ${methodName} MFA\\??`, "i"),
      )
      .isVisible()
  ) {
    await expect(
      page.getByText(
        new RegExp(`Are you sure you want to ${action.toLowerCase()} ${methodName} MFA\\??`, "i"),
      ),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Yes", exact: true }).click();

  if (
    await page
      .getByText(new RegExp(`${methodName} MFA ${action.toLowerCase()}d successfully`))
      .isVisible({ timeout: 15000 })
  ) {
    await expect(
      page.getByText(new RegExp(`${methodName} MFA ${action.toLowerCase()}d successfully`)),
    ).toBeVisible();
  }
}

export async function cancelMfaConfirmationFlow(
  page: Page,
  row: ReturnType<Page["getByRole"]>,
  initialStatus: string,
) {
  await row.getByRole("button").last().click();
  const nextAction: MfaAction = initialStatus === "Enabled" ? "Disable" : "Enable";
  await page.getByRole("menuitem", { name: nextAction, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirmation" })).toBeHidden({ timeout: 8000 });
  await expect(row.getByText(initialStatus || "Disabled")).toBeVisible();
}

export async function verifyMfaStatusFlow(
  row: ReturnType<Page["getByRole"]>,
  expectedStatus: "Enabled" | "Disabled",
) {
  await expect(row.getByText(expectedStatus)).toBeVisible({ timeout: 10000 });
}
