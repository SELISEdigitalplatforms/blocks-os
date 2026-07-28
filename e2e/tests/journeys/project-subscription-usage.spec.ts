import { expect } from "@playwright/test";
import { test } from "../../support/test-base";
import { openProjectOverviewPage } from "../../support/steps/project-overview.steps";

test.describe("Project subscription usage journey", () => {
  test("opens subscription usage for the first available project", async ({ page }) => {
    await openProjectOverviewPage(page, "subscription-usage");
    await expect(page.getByRole("heading", { name: "Subscription Usage" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Track platform consumption across all services")).toBeVisible({
      timeout: 30_000,
    });
  });
});
