import { test, expect } from "../../support/test-base";
import { requireProject } from "../../support/flow-state";
import { openProjectRoute, expectRedirect } from "../../support/flow-routes";

test("08 - covers project overview routes and project redirect", async ({ page }) => {
  test.setTimeout(180_000);
  const { tenantGroupId } = requireProject();

  await expectRedirect(
    page,
    `/app/project/${tenantGroupId}`,
    new RegExp(`/app/project/${tenantGroupId}/environments`),
    ["Environments"],
  );

  await openProjectRoute(page, tenantGroupId, "repositories", ["Repositories"]);
  await openProjectRoute(page, tenantGroupId, "settings", [
    "Project Settings",
    "General Information",
  ]);
  await openProjectRoute(page, tenantGroupId, "subscription-usage", [
    "Subscription Usage",
    "Track platform consumption across all services",
  ]);

  await expect(page).toHaveURL(new RegExp(`/app/project/${tenantGroupId}/subscription-usage`));
});
