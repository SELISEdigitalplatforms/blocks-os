import { test } from "../../support/test-base";
import { expectLmtUsageVisible, openLmtUsage } from "../../support/steps/lmt.steps";

test.describe("Logs and traces usage journey", () => {
  test("opens usage metrics for the first available project", async ({ page }) => {
    await openLmtUsage(page);
    await expectLmtUsageVisible(page);
  });
});
