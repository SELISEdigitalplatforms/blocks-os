import { test, expect } from "../../support/test-base";
import { expectRedirect, expectRouteContent } from "../../support/flow-routes";

test("09 - covers profile, root redirect, and public invalid-link routes", async ({ page }) => {
  test.setTimeout(180_000);

  await expectRedirect(page, "/", /\/app\/console/, []);

  await page.goto("/app/profile");
  await page.waitForURL(/\/app\/profile(?:\/|$|[?])/, { timeout: 30_000 });
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });

  await page.goto("/activate");
  await page.waitForURL(/\/activate(?:\/|$|[?])/, { timeout: 30_000 });
  await expectRouteContent(page, ["Invalid Activation Link", "Go to sign in"]);

  await page.goto("/invitation");
  await page.waitForURL(/\/invitation(?:\/|$|[?])/, { timeout: 30_000 });
  await expectRouteContent(page, ["Invalid invitation link", "missing a confirmation code"]);

  await page.goto("/invitation/result");
  await page.waitForURL(/\/invitation\/result(?:\/|$|[?])/, { timeout: 30_000 });
  await expect(page.locator("main").or(page.locator("body"))).toContainText(/invitation|sign in|login|success/i, {
    timeout: 30_000,
  });
});
