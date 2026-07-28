import { test, expect } from "../../support/test-base";
import { requireProject, resetFlowState } from "../../support/flow-state";

// Sequential flow — step 6 (teardown): delete the project created in step 1.
//
// There is no single "delete project" action in the UI — deletion is per
// environment: enter an environment's dashboard, click Delete, confirm. The
// project disappears once its last environment is gone, so this walks the
// project's own Environments page until it is empty.
//
// Unlike the old tests/project/delete-project.spec.ts, this never scans the
// console for "some e2e-* card" — it only ever touches this run's
// tenantGroupId. Set E2E_KEEP_PROJECT=1 to leave the project behind for
// inspection.

test("06 - delete the project created by this run", async ({ page }) => {
  const { projectName, tenantGroupId } = requireProject();

  test.skip(
    process.env.E2E_KEEP_PROJECT === "1",
    `E2E_KEEP_PROJECT=1 — leaving ${projectName} in place`,
  );

  // Three environments by now (dev + test from step 1, staging from step 2);
  // the guard is generous enough for the full list without looping forever.
  for (let guard = 0; guard < 12; guard++) {
    await page.goto(`/app/project/${tenantGroupId}/environments`);

    // Once the last environment is deleted the project is gone and the route
    // guard bounces back to the console — that is the exit condition.
    if (/\/app\/console/.test(page.url())) break;

    const envCard = page
      .getByText(/^(Development|Testing|Staging|IAT|UAT|Prod Shadow|Pre-Prod|Production)$/)
      .first();

    if ((await envCard.count()) === 0) break;

    // Entering an environment impersonates it and lands on its dashboard.
    await envCard.click();
    await page.waitForURL("**/app/*/dashboard", { timeout: 30_000 });

    // Destructive trigger → confirm inside the dialog.
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

    // On success the app toasts and routes back to the console.
    await page.waitForURL("**/app/console", { timeout: 45_000 });
  }

  // The project should no longer be listed on the console.
  await page.goto("/app/console");
  await expect(page.getByText(projectName, { exact: true })).toHaveCount(0);

  resetFlowState();
});
