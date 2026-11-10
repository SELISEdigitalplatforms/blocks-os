import { expect, type Page } from "@playwright/test";
import { e2eDebugLog } from "../../support/env";
import { openSecretManagement } from "../../support/os-helpers";

/**
 * Integrations page (`/secret-management/integration`): one row per connection.
 * "Add connection" runs the setup (creates role + client credential) and shows
 * the client secret exactly once in the one-time secret dialog. Disconnect
 * revokes the credential — the row stays listed with a "revoked" badge and
 * loses its Regenerate/Disconnect actions.
 */

export async function navigateToIntegrationsFlow(page: Page) {
  await openSecretManagement(page, "integration", "Integrations");
}

export async function verifyEmptyStateFlow(page: Page) {
  // Fresh project: no connections at all. A kept project (E2E_KEEP_PROJECT=1)
  // may still list a revoked leftover row from an earlier run.
  const emptyState = page.getByText("No integrations yet");
  const revokedRow = page
    .locator('[data-testid="integration-connection-row"]')
    .filter({ hasText: "revoked" });
  await expect(emptyState.or(revokedRow.first())).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Add connection" })).toBeVisible();
}

export async function openAddConnectionDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Add connection" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Add connection" })).toBeVisible();
  await expect(dialog.getByText("Access level")).toBeVisible();

  // Templates load async — wait for either the options or the explicit empty text.
  await expect(
    dialog
      .getByRole("radio")
      .first()
      .or(dialog.getByText("No access options are available for this environment.")),
  ).toBeVisible({ timeout: 30_000 });
}

export async function hasAccessTemplates(page: Page): Promise<boolean> {
  const dialog = page.getByRole("dialog");
  if (await dialog.getByText("No access options are available for this environment.").isVisible()) {
    e2eDebugLog(
      "[integrations-flow] No integration access options on this environment — skipping create/regenerate/disconnect steps.",
    );
    return false;
  }
  return true;
}

export async function verifyCreateDisabledWithoutSelectionFlow(page: Page) {
  const dialog = page.getByRole("dialog");
  const create = dialog.getByRole("button", { name: "Create connection" });
  // Nothing selected and no name yet.
  await expect(create).toBeDisabled();
}

export async function selectTemplateAndFillNameFlow(page: Page, connectionName: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio").first().click();
  // The selected option exposes its role assignment next to a permissions count badge.
  await expect(dialog.getByText(/permission/).first()).toBeVisible();

  const nameInput = dialog.getByLabel("Connection name");
  await nameInput.fill(connectionName);
  await expect(dialog.getByRole("button", { name: "Create connection" })).toBeEnabled();
}

export async function clearConnectionNameFlow(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Connection name").fill("");
  await expect(dialog.getByRole("button", { name: "Create connection" })).toBeDisabled();
}

/** Creates the connection and closes the one-time secret dialog when one is shown. */
export async function createConnectionFlow(page: Page) {
  const dialog = page.getByRole("dialog");
  // The setup modal has no error UI — a failed RunSetup silently leaves it
  // open — so capture the request ourselves and fail with the real reason.
  const setupResponse = page.waitForResponse(
    (r) => r.url().includes("/RunSetup") && r.request().method() === "POST",
    { timeout: 60_000 },
  );
  await dialog.getByRole("button", { name: "Create connection" }).click();

  let response;
  try {
    response = await setupResponse;
  } catch {
    throw new Error(
      "Create connection: no /RunSetup request was sent within 60s — the click never reached the mutation.",
    );
  }
  if (!response.ok()) {
    throw new Error(`Create connection: RunSetup failed with HTTP ${response.status()}.`);
  }
  const body = (await response.json().catch(() => null)) as
    | { isSuccess?: boolean; errors?: Record<string, string> | null }
    | null;
  if (body?.isSuccess === false) {
    throw new Error(
      `Create connection: RunSetup returned isSuccess=false (${JSON.stringify(body.errors ?? body)})`,
    );
  }

  // The response may or may not carry the one-time client secret.
  const secretDialog = page.getByRole("dialog").filter({ hasText: "Save this secret now" });
  const secretShown = await secretDialog
    .waitFor({ state: "visible", timeout: 60_000 })
    .then(() => true)
    .catch(() => false);

  if (secretShown) {
    await expect(secretDialog.getByText("Client ID")).toBeVisible();
    await expect(secretDialog.getByText("Client Secret")).toBeVisible();
    await secretDialog.getByRole("button", { name: "Done" }).click();
  } else {
    // No secret in the response — the setup dialog closes itself on success.
    await expect(dialog).toBeHidden({ timeout: 60_000 });
  }
}

export async function verifyConnectionListedFlow(page: Page, connectionName: string) {
  const row = page.locator('[data-testid="integration-connection-row"]').filter({
    hasText: connectionName,
  });
  await expect(row).toHaveCount(1);
  await expect(row.getByText("active", { exact: true })).toBeVisible();
  await expect(row.getByText(/access/, { exact: false })).toBeVisible();
  await expect(row.getByText("Manual", { exact: true })).toBeVisible();
  await expect(row.getByText("Client ID")).toBeVisible();
  await expect(row.getByRole("button", { name: "Copy as JSON" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Regenerate" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Disconnect" })).toBeVisible();

  // Count line includes this row; keep it loose so reruns against a kept
  // project (E2E_KEEP_PROJECT=1) with earlier leftovers still pass.
  await expect(page.getByText(/^\d+ connections?$/)).toBeVisible({ timeout: 30_000 });
}

export async function regenerateSecretFlow(page: Page, connectionName: string) {
  const row = page.locator('[data-testid="integration-connection-row"]').filter({
    hasText: connectionName,
  });
  await row.getByRole("button", { name: "Regenerate" }).click();

  const confirm = page.getByRole("dialog");
  await expect(confirm.getByText("Regenerate the secret?")).toBeVisible();
  await expect(confirm.getByText("The client id stays")).toBeVisible();
  await confirm.getByRole("button", { name: "Regenerate" }).click();

  // The rotate response always carries the new secret — the one-time dialog
  // opens. isVisible() would race the response, so wait for it properly.
  const secretDialog = page.getByRole("dialog").filter({ hasText: "Save this secret now" });
  await secretDialog.waitFor({ state: "visible", timeout: 60_000 });
  await secretDialog.getByRole("button", { name: "Done" }).click();

  // The row must survive a regeneration — only the secret rotates.
  await expect(
    page.locator('[data-testid="integration-connection-row"]').filter({ hasText: connectionName }),
  ).toBeVisible();
}

export async function disconnectConnectionFlow(page: Page, connectionName: string) {
  const row = page.locator('[data-testid="integration-connection-row"]').filter({
    hasText: connectionName,
  });
  await row.getByRole("button", { name: "Disconnect" }).click();

  const confirm = page.getByRole("dialog");
  await expect(confirm.getByText("Disconnect this connection?")).toBeVisible();
  await expect(confirm.getByText("will stop working")).toBeVisible();
  await confirm.getByRole("button", { name: "Disconnect" }).click();

  // Disconnecting revokes the credential but keeps the row: the badge flips to
  // "revoked" and the row loses its Regenerate/Disconnect actions
  // (the list renders them only while status is "active").
  await expect(row.getByText("revoked", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(row.getByRole("button", { name: "Regenerate" })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Disconnect" })).toHaveCount(0);
}
