import { test } from "@playwright/test";
import { createProject, openNamedProjectDashboard } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";
import { readSharedProject, writeSharedProject } from "../../support/shared-project";
import { resetRunOutcome } from "../../support/run-outcome";

// Runs once, after the "setup" (login) project and before every feature
// spec: creates the single project every other spec file in tests/ reuses,
// and records its identity to fixtures/shared-project.json. Reuses an
// existing fixture from a prior (e.g. interrupted) run instead of creating a
// second throwaway project, as long as that project still exists.
test.describe("project setup", () => {
  test("create (or reuse) the one project shared by the whole suite", async ({ page }) => {
    test.setTimeout(180_000);
    resetRunOutcome();

    await ensureAuthenticated(page);

    const existing = readSharedProject();
    if (existing) {
      const stillExists = await openNamedProjectDashboard(page, existing.projectName)
        .then(() => true)
        .catch(() => false);
      if (stillExists) {
        return;
      }
    }

    const { projectName, tenantGroupId, itemId } = await createProject(page);

    writeSharedProject({
      projectName,
      tenantGroupId,
      itemId,
      dashboardUrl: page.url(),
    });
  });
});
