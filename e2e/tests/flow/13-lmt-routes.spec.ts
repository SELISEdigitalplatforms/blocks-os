import { test, expect } from "../../support/test-base";
import { enterProject } from "../../support/navigation";
import { expectRedirect, openScopedRoute } from "../../support/flow-routes";

test("13 - covers LMT usage, logs, service logs, tracing, and trace detail routes", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const itemId = await enterProject(page);
  const traceId = "e2e-trace-id";

  await openScopedRoute(page, itemId, "lmt/usage", ["Global overview", "Total API calls"]);
  await openScopedRoute(page, itemId, "lmt/logs", [
    "Logs",
    "Search and view application logs across your services",
  ]);

  await page.goto(`/app/${itemId}/lmt/logs/e2e-missing-service`);
  await page.waitForURL(new RegExp(`/app/${itemId}/lmt/logs/e2e-missing-service$`), {
    timeout: 30_000,
  });
  await expect(page.getByText("Logs are not configured for this service.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/app/${itemId}/lmt/logs/e2e-missing-service/trace/${traceId}`);
  await page.waitForURL(
    new RegExp(`/app/${itemId}/lmt/logs/e2e-missing-service/trace/${traceId}$`),
    { timeout: 30_000 },
  );
  await expect(page.locator("main")).toContainText(/Trace|Duration|Timeline|Span|not found/i, {
    timeout: 30_000,
  });

  await openScopedRoute(page, itemId, "lmt/tracing", ["Tracing", "Trace requests across services"]);

  await expectRedirect(
    page,
    `/app/${itemId}/lmt/tracing/timeline/${traceId}`,
    new RegExp(`/app/${itemId}/lmt/tracing/${traceId}$`),
    [],
  );
  await expect(page.locator("main")).toContainText(/Trace|Duration|Timeline|Span|not found/i, {
    timeout: 30_000,
  });
});
