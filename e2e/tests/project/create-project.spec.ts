import { test, expect } from "@playwright/test";

// Runs authenticated: the "chromium" project injects the session saved by the
// login setup (storageState in playwright.config.ts), so this file starts on an
// already-logged-in browser and does NOT repeat the login flow.

/** Random project name: e2e-<6 random chars>, e.g. "e2e-k3d9za". */
function randomProjectName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `e2e-${suffix}`;
}

test.describe("Create project", () => {
  test("creates a project through the 3-step wizard", async ({ page }) => {
    const projectName = randomProjectName();

    // Console → open the create-project wizard via the "Add Project" card.
    await page.goto("/app/console");
    await page.getByText("Add Project", { exact: true }).click();
    await page.waitForURL("**/app/create-project");

    // The wizard renders both a mobile and a desktop layout in the DOM (mobile
    // is CSS-hidden), so every control matches twice — scope to the visible one.
    const visible = { visible: true } as const;

    // Step 1 — Name your project + accept the two confirmations.
    await page
      .getByPlaceholder("Enter your project name")
      .filter(visible)
      .fill(projectName);
    const checkboxes = page.getByRole("checkbox").filter(visible);
    await checkboxes.nth(0).check(); // "use Blocks exclusively…"
    await checkboxes.nth(1).check(); // "accept the Terms of services"
    await page.getByRole("button", { name: "Continue" }).filter(visible).click();

    // Step 2 — Add resources: skip linking a repository.
    await expect(
      page.getByRole("heading", { name: "Add resource" }).filter(visible),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).filter(visible).click();

    // Step 3 — Select environments, then submit. Nothing is pre-checked and the
    // form requires >= 1, so select the first five (Development, Testing,
    // Staging, IAT, UAT) — this also triggers validation and enables Submit.
    await expect(
      page.getByText("Select environments").filter(visible),
    ).toBeVisible();
    const envCheckboxes = page.getByRole("checkbox").filter(visible);
    for (let i = 0; i < 2; i++) {
      await envCheckboxes.nth(i).check();
    }
    await page.getByRole("button", { name: "Submit" }).filter(visible).click();

    // Success: toast + redirect to the new project's environments page.
    await expect(
      page.getByText("Your project has been created.").first(),
    ).toBeVisible({ timeout: 45_000 });
    await page.waitForURL("**/app/project/*/environments", { timeout: 45_000 });
    await expect(page).toHaveURL(/\/app\/project\/[^/]+\/environments/);
  });
});
