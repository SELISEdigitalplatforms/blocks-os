import { test, expect } from "@playwright/test";
import { randomToken, writeFlowState } from "../../support/flow-state";

// Sequential flow — step 1: create a project with 2 environments (Development,
// Testing). Saves the project name + tenantGroupId for the later steps.
// Runs authenticated via the saved login session (see playwright.config.ts).

test("01 - create project with 2 environments", async ({ page }) => {
  const projectName = `e2e-${randomToken(6)}`;
  const visible = { visible: true } as const;

  await page.goto("/app/console");
  await page.getByText("Add Project", { exact: true }).click();
  await page.waitForURL("**/app/create-project");

  // Step 1 — name + confirmations.
  await page
    .getByPlaceholder("Enter your project name")
    .filter(visible)
    .fill(projectName);
  const confirmations = page.getByRole("checkbox").filter(visible);
  await confirmations.nth(0).check();
  await confirmations.nth(1).check();
  await page.getByRole("button", { name: "Continue" }).filter(visible).click();

  // Step 2 — skip resources.
  await expect(
    page.getByRole("heading", { name: "Add resource" }).filter(visible),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).filter(visible).click();

  // Step 3 — pick Development + Testing (first two), submit.
  await expect(
    page.getByText("Select environments").filter(visible),
  ).toBeVisible();
  const envs = page.getByRole("checkbox").filter(visible);
  await envs.nth(0).check(); // Development
  await envs.nth(1).check(); // Testing
  await page.getByRole("button", { name: "Submit" }).filter(visible).click();

  // Success → new project's environments page.
  await expect(
    page.getByText("Your project has been created.").first(),
  ).toBeVisible({ timeout: 45_000 });
  await page.waitForURL("**/app/project/*/environments", { timeout: 45_000 });

  const tenantGroupId =
    page.url().match(/\/app\/project\/([^/]+)\/environments/)?.[1] ?? "";
  expect(tenantGroupId, "could not read tenantGroupId from URL").not.toBe("");

  writeFlowState({ projectName, tenantGroupId });
});
