import { test } from "../../support/test-base";
import { expectRouteContent } from "../../support/flow-routes";

test("14 - covers the app-level data migration flow surface", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/app/data-migration");
  await page.waitForURL(/\/app\/data-migration(?:\/|$|[?])/, { timeout: 30_000 });
  await expectRouteContent(page, ["Environment migration", "Select environments & services"]);
});
