import { test } from "../../support/test-base";
import {
  navigateToLogsFlow,
  toggleMyServiceSourceFlow,
  sourceParamSurvivesReloadFlow,
  openServiceLogDetailsFlow,
  serviceDetailsTabToggleFlow,
  copyLogTraceIdFlow,
  searchLogStreamFlow,
  filterLogsByTypeFlow,
  filterLogsByServiceFlow,
  filterLogsByDateFlow,
  followLogTraceLinkFlow,
} from "../../pages/logs-and-traces/logs";

// Logs flow: navigate into the sub-section under Logs & Traces, toggle its
// log source tabs, follow a service card into its details view, then
// exercise the log stream's Search and Type (level) filters.
test.describe("flows", () => {
  test("Logs flow: navigate to Logs -> toggle source -> open a service's details", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Logs", async () => {
      await navigateToLogsFlow(page);
    });

    // The source tabs (Managed Service / My Service) live only on the Logs
    // list page — selecting a service below navigates away into its details
    // view, which has no tab strip, so the toggle must happen first.
    await test.step("Toggle to 'My Service' log source", async () => {
      await toggleMyServiceSourceFlow(page);
    });

    await test.step("The ?source= param survives a page refresh", async () => {
      await sourceParamSurvivesReloadFlow(page);
    });

    // On a fresh project the "My Service" list has zero entries — the
    // step returns false and every downstream detail-page step no-ops.
    // This is intentional: the test exercises the page UI; it can't
    // fabricate service traffic.
    const hasService = await test.step("Select a service card to open its log details view", async () => {
      return await openServiceLogDetailsFlow(page);
    });

    await test.step("The service details page has its own Managed/My Service tabs", async () => {
      await serviceDetailsTabToggleFlow(page, hasService);
    });

    await test.step("Copy a log entry's trace ID to the clipboard", async () => {
      await copyLogTraceIdFlow(page, hasService);
    });

    await test.step("Search filters the log stream by text", async () => {
      await searchLogStreamFlow(page, "nonexistent-log-marker-xyz", hasService);
    });

    await test.step("The 'Type' filter narrows the stream to the selected level", async () => {
      await filterLogsByTypeFlow(page, "Error", hasService);
    });

    await test.step("The 'Service' filter narrows the stream to one service", async () => {
      await filterLogsByServiceFlow(page, hasService);
    });

    await test.step("The 'Date' range filter narrows the stream to a picked range", async () => {
      await filterLogsByDateFlow(page, hasService);
    });

    await test.step("Following a log's trace link opens its trace details view", async () => {
      await followLogTraceLinkFlow(page, hasService);
    });
  });
});
