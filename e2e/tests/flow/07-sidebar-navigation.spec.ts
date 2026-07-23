import { test, expect } from "../../support/test-base";
import { loginFresh, enterConsole, openSidebarItem } from "../../support/navigation";

// Navigation spec: confirms each top-level sidebar group opens from the
// console and renders the expected page heading. Runs authenticated via
// fixtures/auth.json (the [chromium] project already has storageState set),
// so loginFresh is only called by tests that explicitly opt in.

test.describe.configure({ mode: "serial" });

test("navigates from console to API Settings", async ({ page }) => {
  test.setTimeout(180_000);
  await loginFresh(page);
  await enterConsole(page);

  await openSidebarItem(page, "API Settings");
  await page.waitForURL(/\/app\/api-settings/, { timeout: 30_000 });

  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 30_000,
  });
});

test("navigates from console to IDP", async ({ page }) => {
  test.setTimeout(180_000);
  await loginFresh(page);
  await enterConsole(page);

  await openSidebarItem(page, "IDP");
  await page.waitForURL(/\/app\/idp(\/|$)/, { timeout: 30_000 });

  // The IDP group has three children — at least one should be visible after
  // the parent expands.
  await expect(
    page.getByRole("link", { name: "Settings" }).first(),
  ).toBeVisible({ timeout: 30_000 });
});

test("navigates from console to Secrets & Configs", async ({ page }) => {
  test.setTimeout(180_000);
  await loginFresh(page);
  await enterConsole(page);

  await openSidebarItem(page, "Secrets & Configs");
  await page.waitForURL(/\/app\/secret-management(\/|$)/, { timeout: 30_000 });

  // My Services is the default landing page inside Secrets & Configs.
  await expect(
    page.getByRole("heading", { name: "My Services" }),
  ).toBeVisible({ timeout: 30_000 });
});

test("navigates from console to LMT", async ({ page }) => {
  test.setTimeout(180_000);
  await loginFresh(page);
  await enterConsole(page);

  await openSidebarItem(page, "Logs & Traces");
  await page.waitForURL(/\/app\/lmt(\/|$)/, { timeout: 30_000 });

  // LMT exposes Usage / Tracing / Logs as sidebar children.
  await expect(
    page
      .getByRole("link", { name: "Logs" })
      .or(page.getByRole("link", { name: "Tracing" }))
      .or(page.getByRole("link", { name: "Usage" }))
      .first(),
  ).toBeVisible({ timeout: 30_000 });
});
