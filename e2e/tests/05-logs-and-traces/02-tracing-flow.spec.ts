import { test } from "../../support/test-base";
import { openOsDashboard, openLmt } from "../../support/os-helpers";
import {
  navigateToTracingFlow,
  walkTraceModesFlow,
  toggleGuidePanelFlow,
  openAiAgentSheetFlow,
  searchTracesFlow,
  filterTracesByServiceFlow,
  sortTracesByTimestampFlow,
  paginateTracesFlow,
  openTraceDetailsFlow,
  unknownTraceIdShowsNotFoundFlow,
} from "../../pages/logs-and-traces/tracing";

// Tracing flow: navigate into the sub-section under Logs & Traces, walk the
// Hot/Cold/Archive trace modes, filter by Service, and open a trace into its
// span breakdown before closing with an invalid-trace-ID check.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await openOsDashboard(page);
  });

  test("Tracing flow: navigate to Tracing", async ({ page }) => {
    test.setTimeout(180_000);

    const gotoLmtChild = async () => {
      const link = page.getByRole("link", { name: "Tracing" });
      if (await link.isVisible({ timeout: 3_000 })) {
        await link.click({ timeout: 10_000 });
        return;
      }
      await openLmt(page, "tracing");
    };

    await test.step("Navigate to Tracing", async () => {
      await navigateToTracingFlow(page);
    });

    await test.step("Cold and Archive trace modes show 'Coming soon', Hot has live data", async () => {
      await walkTraceModesFlow(page);
    });

    await test.step("The 'Guide' button opens the Trace Guide panel", async () => {
      await toggleGuidePanelFlow(page);
    });

    await test.step("The AI agent sheet opens", async () => {
      await openAiAgentSheetFlow(page);
    });

    await test.step("Search filters the traces list", async () => {
      await searchTracesFlow(page, "nonexistent-trace-marker-xyz");
    });

    await test.step("Filtering traces by Service narrows the results", async () => {
      await filterTracesByServiceFlow(page);
    });

    await test.step("Sort by the Timestamp column header", async () => {
      await sortTracesByTimestampFlow(page);
    });

    await test.step("Paginate the traces list, if more than one page exists", async () => {
      await paginateTracesFlow(page);
    });

    await test.step("Selecting a trace opens its detailed span breakdown", async () => {
      await openTraceDetailsFlow(page, gotoLmtChild);
    });

    await test.step("An unknown trace ID shows 'Trace not found', distinct from a load error", async () => {
      await unknownTraceIdShowsNotFoundFlow(page);
    });
  });
});
