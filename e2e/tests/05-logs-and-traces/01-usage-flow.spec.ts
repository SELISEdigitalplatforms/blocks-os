import { test } from "../../support/test-base";
import {
  navigateToUsageFlow,
  assertGlobalOverviewMetricsFlow,
  cycleTimeRangeFlow,
  refreshUsageFlow,
  toggleApiWorkerSwitchFlow,
  openServiceLogsFromUsageFlow,
} from "../../pages/logs-and-traces/usage";

// Usage flow: navigate into the sub-section under Logs & Traces, then walk
// its real interactive surface — the time-range selector and the per-service
// API/Worker metric switch. No dashboard beforeEach — openLmt goes straight
// to /lmt/usage (same as logs-flow). The extra dashboard goto was timing out
// before this test ever reached Usage.
test.describe("flows", () => {
  test("Usage flow: navigate to Usage", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Usage", async () => {
      await navigateToUsageFlow(page);
    });

    await test.step("Global overview shows the four summary metrics", async () => {
      await assertGlobalOverviewMetricsFlow(page);
    });

    await test.step("The time-range selector switches between Last Hour, Last 24 Hours and Last 7 Days", async () => {
      await cycleTimeRangeFlow(page);
    });

    await test.step("The 'Refresh' button re-triggers the usage query", async () => {
      await refreshUsageFlow(page);
    });

    await test.step("A per-service card's API/Worker metric switch offers both options", async () => {
      await toggleApiWorkerSwitchFlow(page);
    });

    await test.step("A per-service card's 'View logs' link opens that service's Logs page", async () => {
      await openServiceLogsFromUsageFlow(page);
    });
  });
});
