import { test } from "@playwright/test";
import { deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";
import { readSharedProject, clearSharedProject } from "../../support/shared-project";
import { shouldDeleteSharedProject } from "../../support/run-outcome";

// Runs once, after every feature spec file has finished: deletes the shared
// project, but only when every test that used it passed — a failure keeps it
// around on the console for inspection instead.
test.describe("project teardown", () => {
  test("delete the shared project when every test passed", async ({ page }) => {
    test.setTimeout(120_000);

    const fixture = readSharedProject();
    if (!fixture) return;

    if (!shouldDeleteSharedProject()) {
      console.log(
        `[e2e] Keeping project "${fixture.projectName}" on the console ` +
          "(a test failed, or E2E_KEEP_PROJECT=1).",
      );
      return;
    }

    await ensureAuthenticated(page);
    const deleted = await deleteCreatedProject(page, fixture.projectName);

    if (deleted) {
      clearSharedProject();
    } else {
      console.log(
        `[e2e] Project "${fixture.projectName}" was not deleted automatically — ` +
          "remove it manually from the console if needed.",
      );
    }
  });
});
