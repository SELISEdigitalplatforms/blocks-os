import { test } from "../../support/test-base";
import { expectLmtLogsVisible, openLmtLogs } from "../../support/steps/lmt.steps";

test.describe("Logs and traces logs journey", () => {
  test("opens logs for the first available project", async ({ page }) => {
    await openLmtLogs(page);
    await expectLmtLogsVisible(page);
  });
});
