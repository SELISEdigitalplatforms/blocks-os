import { test, expect } from "../../support/test-base";
import { loginFresh, enterConsole, enterProject, openSidebarItem } from "../../support/navigation";

// Navigation spec: confirms each top-level sidebar group opens from the
// dashboard layout. The sidebar lives inside /app/:itemId/*, so we first
// click into a project from the console (its environment chip sets the
// active :itemId and lands us on /app/<id>/dashboard). After that the full
// sidebar — API Settings / IDP / Secrets & Configs / Logs & Traces — is
// available and we click each group in turn.
//
// Each test sets its own timeout because the flow re-runs loginFresh.

test("navigates from console to API Settings", async ({ page }) => {
  test.setTimeout(180_000);
  await loginFresh(page);
  await enterConsole(page);
  const itemId = await enterProject(page);

  await openSidebarItem(page, "API Settings");
  await page.waitForURL(new RegExp(`/app/${itemId}/api-settings`), {
    timeout: 30_000,
  });
});

test("navigates from console to IDP", async ({ page }) => {
  test.setTimeout(180_000);
  await loginFresh(page);
  await enterConsole(page);
  const itemId = await enterProject(page);

  await openSidebarItem(page, "IDP");
  await page.waitForURL(new RegExp(`/app/${itemId}/idp`), { timeout: 30_000 });
});

test("navigates from console to Secrets & Configs", async ({ page }) => {
  test.setTimeout(180_000);
  await loginFresh(page);
  await enterConsole(page);
  const itemId = await enterProject(page);

  await openSidebarItem(page, "Secrets & Configs");
  await page.waitForURL(new RegExp(`/app/${itemId}/secret-management`), { timeout: 30_000 });

  // My Services is the default landing page inside Secrets & Configs.
  await expect(page.getByRole("heading", { name: "My Services" })).toBeVisible({ timeout: 30_000 });
});

test("navigates from console to LMT", async ({ page }) => {
  test.setTimeout(180_000);
  await loginFresh(page);
  await enterConsole(page);
  const itemId = await enterProject(page);

  // Sidebar label is "Logs & Traces" (LMT = internal codename for the
  // Logs / Metrics / Traces product).
  await openSidebarItem(page, "Logs & Traces");
  await page.waitForURL(new RegExp(`/app/${itemId}/lmt`), { timeout: 30_000 });
});
