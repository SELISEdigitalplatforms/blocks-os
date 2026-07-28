import { test } from "../../support/test-base";
import { expectLmtTracingVisible, openLmtTracing } from "../../support/steps/lmt.steps";

test.describe("Logs and traces tracing journey", () => {
  test("opens tracing for the first available project", async ({ page }) => {
    await openLmtTracing(page);
    await expectLmtTracingVisible(page);
  });
});
