import type { Page } from "@playwright/test";
import { test, expect } from "../../support/test-base";

// Secrets & Configs > Secret Management flow.
//
// Routes & elements these specs target (verified against the codebase):
//   /app/secret-management/my-secret  →  <PageHeader> titled "Secret Management"
//     - header action: [Create]  (CreateSecretButton)
//     - toolbar: search input, Type filter, Status filter, Reset
//     - table columns: Secret | Type | Status | Created On | Actions
//   Row actions live in a "Actions for <name>" dropdown, plus inline
//   Reveal/Copy icon buttons for readable api secrets.
//
// Requires secret permissions to be seeded for the tenant — without them every
// /api/secrets endpoint returns 403 and the list renders "Not available for
// your account" instead of the table.
//
// No project context is required for secret-management, so we don't depend on
// requireProject() here — the global project store still has whatever was last
// selected.

const SECRET_NAME = `e2e-secret-${Date.now()}`;
const INITIAL_VALUE = "initial-value-0001";
const ROTATED_VALUE = "rotated-value-0002";

const openList = async (page: Page) => {
  await page.goto("/app/secret-management/my-secret");
  await expect(page.getByRole("heading", { name: "Secret Management" })).toBeVisible();
};

const rowActions = async (page: Page, name: string) => {
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  return page.getByRole("menu");
};

// One spec end-to-end: the lifecycle transitions depend on each other, and the
// suite already runs serially (workers: 1).
test("secrets&config-mysecret-lifecycle", async ({ page }) => {
  await openList(page);

  // ── Create ────────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Create" }).click();
  const createDialog = page.getByRole("dialog");
  await expect(createDialog.getByRole("heading", { name: "Create secret" })).toBeVisible();

  // Every secret is created active — the backend has no status on SetSecretRequest.
  await expect(createDialog.getByLabel(/^Status/)).toHaveCount(0);

  await createDialog.getByLabel(/^Name/).fill(SECRET_NAME);
  await createDialog.getByLabel(/^Description/).fill("Created by the e2e suite");
  await createDialog.getByLabel(/Secret value/).fill(INITIAL_VALUE);
  await createDialog.getByRole("button", { name: "Save" }).click();

  // ── List ──────────────────────────────────────────────────────────────────
  const row = page.getByRole("row", { name: new RegExp(SECRET_NAME) });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row.getByText("API")).toBeVisible();
  await expect(row.getByText("Active")).toBeVisible();

  // Filtering by name survives a reload through the URL.
  await page.getByPlaceholder(/Search by name, description or secret ID/).first().fill(SECRET_NAME);
  await expect(page).toHaveURL(new RegExp(`secretSearch=${SECRET_NAME}`), { timeout: 15_000 });
  await page.reload();
  await expect(page.getByRole("row", { name: new RegExp(SECRET_NAME) })).toBeVisible();

  // ── Reveal ────────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Reveal value" }).first().click();
  const revealDialog = page.getByRole("dialog");
  await expect(revealDialog.getByText(/recorded in the audit log/i)).toBeVisible();
  // Masked until asked for.
  await expect(revealDialog.getByTestId("secret-value")).toHaveCount(0);
  await revealDialog.getByRole("button", { name: "Show value" }).click();
  await expect(revealDialog.getByTestId("secret-value")).toHaveText(INITIAL_VALUE);
  await revealDialog.getByRole("button", { name: "Close" }).click();

  // ── Rotate ────────────────────────────────────────────────────────────────
  let menu = await rowActions(page, SECRET_NAME);
  await menu.getByText("Rotate").click();
  const rotateDialog = page.getByRole("dialog");
  await rotateDialog.getByRole("button", { name: "Continue" }).click();
  await rotateDialog.getByLabel(/New value/).fill(ROTATED_VALUE);
  await rotateDialog.getByRole("button", { name: "Rotate" }).click();
  await expect(rotateDialog).toHaveCount(0, { timeout: 30_000 });

  await page.getByRole("button", { name: "Reveal value" }).first().click();
  const revealAgain = page.getByRole("dialog");
  await revealAgain.getByRole("button", { name: "Show value" }).click();
  await expect(revealAgain.getByTestId("secret-value")).toHaveText(ROTATED_VALUE);
  await revealAgain.getByRole("button", { name: "Close" }).click();

  // ── Lock ──────────────────────────────────────────────────────────────────
  menu = await rowActions(page, SECRET_NAME);
  await menu.getByText("Lock").click();
  await page.getByRole("dialog").getByRole("button", { name: "Lock" }).click();

  await expect(
    page.getByRole("row", { name: new RegExp(SECRET_NAME) }).getByText("Locked"),
  ).toBeVisible({ timeout: 30_000 });
  // A locked secret offers no reveal affordance at all.
  await expect(page.getByRole("button", { name: "Reveal value" })).toHaveCount(0);

  // ── Unlock ────────────────────────────────────────────────────────────────
  menu = await rowActions(page, SECRET_NAME);
  await menu.getByText("Unlock").click();
  await page.getByRole("dialog").getByRole("button", { name: "Unlock" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(SECRET_NAME) }).getByText("Active"),
  ).toBeVisible({ timeout: 30_000 });

  // ── Delete ────────────────────────────────────────────────────────────────
  menu = await rowActions(page, SECRET_NAME);
  await menu.getByText("Delete").click();
  const deleteDialog = page.getByRole("dialog");
  // Soft delete: the copy must not claim it is permanent.
  await expect(deleteDialog.getByText(/soft delete/i)).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Delete" }).click();

  // Gone from the default view, which excludes deleted rows.
  await expect(page.getByRole("row", { name: new RegExp(SECRET_NAME) })).toHaveCount(0, {
    timeout: 30_000,
  });

  // ── Restore ───────────────────────────────────────────────────────────────
  await page.goto(
    `/app/secret-management/my-secret?secretSearch=${SECRET_NAME}&secretStatus=deleted`,
  );
  const deletedRow = page.getByRole("row", { name: new RegExp(SECRET_NAME) });
  await expect(deletedRow).toBeVisible({ timeout: 30_000 });
  await expect(deletedRow.getByText("Deleted")).toBeVisible();

  menu = await rowActions(page, SECRET_NAME);
  // A deleted secret offers Restore and Audit only.
  await expect(menu.getByText("Restore")).toBeVisible();
  await expect(menu.getByText("Audit")).toBeVisible();
  await expect(menu.getByText("Edit")).toHaveCount(0);
  await expect(menu.getByText("Rotate")).toHaveCount(0);
  await menu.getByText("Restore").click();
  await page.getByRole("dialog").getByRole("button", { name: "Restore" }).click();

  await page.goto(`/app/secret-management/my-secret?secretSearch=${SECRET_NAME}`);
  await expect(
    page.getByRole("row", { name: new RegExp(SECRET_NAME) }).getByText("Active"),
  ).toBeVisible({ timeout: 30_000 });
});

test("mysecret-service-secret-has-no-reveal", async ({ page }) => {
  const serviceName = `e2e-service-secret-${Date.now()}`;
  await openList(page);

  await page.getByRole("button", { name: "Create" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Service" }).click();
  // Service secrets have no access list, so the picker is not offered.
  await expect(dialog.getByText("Allowed users")).toHaveCount(0);
  await dialog.getByLabel(/^Name/).fill(serviceName);
  await dialog.getByLabel(/Secret value/).fill("service-value-0001");
  await dialog.getByRole("button", { name: "Save" }).click();

  const row = page.getByRole("row", { name: new RegExp(serviceName) });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row.getByText("Service")).toBeVisible();
  await expect(row.getByRole("button", { name: "Reveal value" })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Copy value" })).toHaveCount(0);

  // Clean up so repeated runs do not accumulate secrets.
  await page.getByRole("button", { name: `Actions for ${serviceName}` }).click();
  await page.getByRole("menu").getByText("Delete").click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
});

test("mysecret-audit-log", async ({ page }) => {
  await page.goto(`/app/secret-management/my-secret?secretSearch=${SECRET_NAME}`);
  await expect(page.getByRole("heading", { name: "Secret Management" })).toBeVisible();

  const menu = await rowActions(page, SECRET_NAME);
  await menu.getByText("Audit").click();

  const auditDialog = page.getByRole("dialog");
  await expect(auditDialog.getByRole("heading", { name: /Audit log/ })).toBeVisible();
  // The API stores no version history, so there is no Versions tab to find.
  await expect(auditDialog.getByRole("tab", { name: /Versions/ })).toHaveCount(0);
  // The lifecycle spec produced these rows.
  await expect(auditDialog.getByText("GetValue").first()).toBeVisible({ timeout: 30_000 });
  await expect(auditDialog.getByText("Rotate").first()).toBeVisible();
});
