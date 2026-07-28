import { expect } from "@playwright/test";
import { test } from "../../support/test-base";
import { openProjectOverviewPage } from "../../support/steps/project-overview.steps";

test.describe("Project repositories journey", () => {
  test("opens repositories for the first available project", async ({ page }) => {
    await openProjectOverviewPage(page, "repositories");
    await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
