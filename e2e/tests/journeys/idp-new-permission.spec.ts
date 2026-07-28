import { expect } from "@playwright/test";
import { test } from "../../support/test-base";
import { openIdpPage } from "../../support/steps/idp.steps";

test.describe("IDP new permission journey", () => {
  test("opens the new permission form for the first available project", async ({ page }) => {
    await openIdpPage(page, "permission-detail/new");
    await expect(page.getByText("New Permission")).toBeVisible({ timeout: 30_000 });
  });
});
