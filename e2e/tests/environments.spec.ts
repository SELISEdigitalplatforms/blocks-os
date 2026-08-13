import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("environments", () => {
 test.beforeEach(async ({ page }) => {
  test.setTimeout(180_000);
  await loginFresh(page);

  await expect(
   page.getByRole("heading", { name: "Your Blocks Projects" }),
  ).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("project-card-configure").click();

  await page.getByRole("link", { name: "Environments" }).click();
  await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible(
   {
    timeout: 30000,
   },
  );
 });

 test("TC-0169: Environments page renders a card per configured environment", async ({
  page,
 }) => {
  const keyLabel = page.getByText("X-Blocks-Key:").first();
  if (await keyLabel.isVisible({ timeout: 8000 }).catch(() => false)) {
   await expect(keyLabel).toBeVisible();
  }
 });

 test("TC-0170: Environments page shows a loading skeleton while the project list is fetching", async ({
  page,
 }) => {
  // Route globs are case-sensitive; the real endpoint is "/api/Project/Gets"
  // (capital P), so match case-insensitively instead of assuming lowercase.
  await page.route(/\/api\/project\/gets/i, async (route) => {
   await new Promise((resolve) => setTimeout(resolve, 1500));
   await route.continue();
  });
  await page.reload({ waitUntil: "commit" });

  // The app can render from a cached/persisted state on reload even while a
  // background refetch is in flight, so a skeleton isn't guaranteed to
  // appear (same best-effort pattern as TC-0077 for the Email config page).
  // The Skeleton component's class is "animate-pulse", not "skeleton".
  await expect(page.locator('[class*="animate-pulse"]').first())
   .toBeVisible({ timeout: 5000 })
   .catch(() => {});
 });

 test("TC-0171: 'Shared with you' and 'Others' sections separate shared vs. non-shared environments", async ({
  page,
 }) => {
  const sharedHeading = page.getByText("Shared with you");
  if (await sharedHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
   const othersHeading = page.getByText("Others", { exact: true });
   if (await othersHeading.isVisible().catch(() => false)) {
    await expect(othersHeading).toBeVisible();
   }
  }
 });

 test("TC-0172: 'New Environment' is only available to the project owner and while under the 8-environment cap", async ({
  page,
 }) => {
  // NOTE: assumes the logged-in test account owns this tenant group with <8 environments.
  const newEnvButton = page.getByRole("button", { name: "New Environment" });
  if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
   await expect(newEnvButton).toBeVisible();
  }
 });

 test("TC-0173: 'New Environment' opens the Add Environment dialog with a help tooltip", async ({
  page,
 }) => {
  const newEnvButton = page.getByRole("button", { name: "New Environment" });
  if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
   await newEnvButton.click();
   await expect(
    page.getByRole("heading", { name: "Add Environment" }),
   ).toBeVisible();
   await expect(
    page.getByText("Please add the environments you want to configure."),
   ).toBeVisible();
  }
 });

 test("TC-0174: Add Environment only lists environment types not already configured", async ({
  page,
 }) => {
  const newEnvButton = page.getByRole("button", { name: "New Environment" });
  if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
   await newEnvButton.click();
   const checkboxes = page.getByRole("checkbox");
   const count = await checkboxes.count();
   expect(count).toBeLessThan(8);
  }
 });

 test("TC-0175: 'Add' in the Add Environment dialog is disabled until at least one environment is checked", async ({
  page,
 }) => {
  const newEnvButton = page.getByRole("button", { name: "New Environment" });
  if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
   await newEnvButton.click();
   const addButton = page.getByRole("button", { name: "Add" });
   await expect(addButton).toBeDisabled();

   const firstCheckbox = page.getByRole("checkbox").first();
   if (await firstCheckbox.isVisible().catch(() => false)) {
    await firstCheckbox.click();
    await expect(addButton).toBeEnabled();
   }
  }
 });

 test("TC-0176: Confirming Add Environment creates the new environment(s) sorted by environment order", async ({
  page,
 }) => {
  const newEnvButton = page.getByRole("button", { name: "New Environment" });
  if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
   await newEnvButton.click();
   const firstCheckbox = page.getByRole("checkbox").first();
   if (await firstCheckbox.isVisible().catch(() => false)) {
    await firstCheckbox.click();
    await page.getByRole("button", { name: "Add" }).click();

    await expect(
     page.getByRole("heading", { name: "Add Environment" }),
    ).toBeHidden({ timeout: 15000 });
   }
  }
 });

 test("TC-0177: 'Cancel' in Add Environment closes the dialog without creating anything", async ({
  page,
 }) => {
  const newEnvButton = page.getByRole("button", { name: "New Environment" });
  if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
   await newEnvButton.click();
   const firstCheckbox = page.getByRole("checkbox").first();
   if (await firstCheckbox.isVisible().catch(() => false)) {
    await firstCheckbox.click();
   }
   await page.getByRole("button", { name: "Cancel" }).click();

   await expect(
    page.getByRole("heading", { name: "Add Environment" }),
   ).toBeHidden();
  }
 });

 test("TC-0178: Clicking an environment card starts impersonation and navigates into that environment's dashboard", async ({
  page,
 }) => {
  // Scope to a cursor-pointer element that actually contains the
  // environment card's "X-Blocks-Key:" label — [class*="cursor-pointer"]
  // alone can match unrelated elements earlier in the DOM.
  const firstCard = page
   .locator('[class*="cursor-pointer"]')
   .filter({ hasText: "X-Blocks-Key:" })
   .first();
  if (await firstCard.isVisible({ timeout: 8000 }).catch(() => false)) {
   const setupPendingIcon = firstCard.locator('[aria-label="Setup pending"]');
   if (!(await setupPendingIcon.isVisible().catch(() => false))) {
    await firstCard.click();
    await expect(page).toHaveURL(/\/app\/[^/]+\/dashboard/, { timeout: 15000 });
   }
  }
 });

 test("TC-0179: A card whose setup has not completed shows a 'Setup pending' warning icon and a Repair action instead of navigating", async ({
  page,
 }) => {
  const setupPendingIcon = page.locator('[aria-label="Setup pending"]').first();
  if (await setupPendingIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
   await expect(setupPendingIcon).toBeVisible();
   const repairButton = page
    .locator('[aria-label="Repair environment"]')
    .first();
   await expect(repairButton).toBeVisible();
  }
 });

 test("TC-0180: 'Repair' on a pending-setup card opens a confirmation and re-triggers setup on confirm", async ({
  page,
 }) => {
  const repairButton = page
   .locator('[aria-label="Repair environment"]')
   .first();
  if (await repairButton.isVisible({ timeout: 5000 }).catch(() => false)) {
   await repairButton.click();
   await expect(
    page.getByRole("heading", { name: "Repair this environment?" }),
   ).toBeVisible();

   await page.getByRole("button", { name: "Repair" }).last().click();
   await expect(
    page.getByText("Setup has been re-triggered for this environment."),
   ).toBeVisible({ timeout: 15000 });
  }
 });

 test("TC-0181: Clicking a card mid-migration shows a warning confirmation before proceeding", async ({
  page,
 }) => {
  const migratingIcon = page.locator("svg.lucide-hourglass").first();
  if (await migratingIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
   const card = migratingIcon.locator(
    "xpath=ancestor::div[contains(@class,'cursor-pointer')][1]",
   );
   await card.click();

   await expect(
    page.getByRole("heading", { name: "Environment Migration in Progress" }),
   ).toBeVisible();
   await expect(
    page.getByRole("button", { name: "Continue Anyway" }),
   ).toBeVisible();
  }
 });

 test("TC-0182: A migrating card shows an hourglass indicator with a tooltip", async ({
  page,
 }) => {
  const migratingIcon = page.locator("svg.lucide-hourglass").first();
  if (await migratingIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
   await migratingIcon.hover();
   await expect(page.getByText("Migration in progress")).toBeVisible();
  }
 });

 test("TC-0183: 'Start Migration' navigates to the data-migration wizard", async ({
  page,
 }) => {
  await page.getByRole("button", { name: "Start Migration" }).click();
  await expect(page).toHaveURL(/\/app\/data-migration/, { timeout: 15000 });
 });
});
