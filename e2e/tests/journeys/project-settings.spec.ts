import { expect } from "@playwright/test";
import { test } from "../../support/test-base";
import { openProjectOverviewPage } from "../../support/steps/project-overview.steps";

test.describe("Project settings journey", () => {
  test("opens project settings for the first available project", async ({ page }) => {
    await openProjectOverviewPage(page, "settings");
    await expect(page.getByRole("heading", { name: "Project Settings" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("General Information")).toBeVisible({ timeout: 30_000 });
  });
});
