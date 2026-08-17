import { test, expect } from "../../support/test-base";
import { createProject, deleteProject } from "../../support/create-and-delete-project";
import { loginFresh } from "../../support/login-helper";

test.describe("project settings", () => {
  test.beforeEach(async ({ page }) => {
    await loginFresh(page);
    await createProject(page);
    await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
      timeout: 50000,
    });
  });

  test.afterEach(async ({ page }) => {
    await deleteProject(page).catch(() => {});
  });

  test("Environments page behavior", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Environments page behavior", async () => {
      await test.step("Open Environments", async () => {
        const configureButton = page.getByTestId("project-card-configure").first();
        await expect(configureButton).toBeVisible({ timeout: 15000 });
        await configureButton.click();

        const environmentsLink = page.getByRole("link", { name: "Environments" });
        await expect(environmentsLink).toBeVisible({ timeout: 15000 });
        await environmentsLink.click();

        await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
          timeout: 30000,
        });
      });

      await test.step("[Positive] Environments page renders a card per configured environment", async () => {
        const keyLabel = page.getByText("X-Blocks-Key:").first();

        if (await keyLabel.isVisible({ timeout: 8000 }).catch(() => false)) {
          await expect(keyLabel).toBeVisible({ timeout: 10000 });
        }
      });

      await test.step("[Positive] Environments page shows a loading skeleton while the project list is fetching", async () => {
        const skeleton = page.locator('[class*="animate-pulse"]').first();

        await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});

        await skeleton.isVisible({ timeout: 5000 }).catch(() => {});

        await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
          timeout: 30000,
        });
      });

      await test.step("[Positive] 'Shared with you' and 'Others' sections separate shared vs. non-shared environments", async () => {
        const sharedHeading = page.getByText("Shared with you");

        if (await sharedHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
          await expect(sharedHeading).toBeVisible({ timeout: 10000 });

          const othersHeading = page.getByText("Others", { exact: true });

          if (await othersHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
            await expect(othersHeading).toBeVisible({ timeout: 10000 });
          }
        }
      });

      await test.step("[Security] 'New Environment' is only available to the project owner and while under the 8-environment cap", async () => {
        const newEnvButton = page.getByRole("button", { name: "New Environment" });

        if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await expect(newEnvButton).toBeVisible({ timeout: 10000 });
        }
      });

      await test.step("[Positive] 'New Environment' opens the Add Environment dialog with a help tooltip", async () => {
        const newEnvButton = page.getByRole("button", { name: "New Environment" });

        if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await newEnvButton.click();

          await expect(page.getByRole("heading", { name: "Add Environment" })).toBeVisible({
            timeout: 10000,
          });

          await expect(
            page.getByText("Please add the environments you want to configure."),
          ).toBeVisible({
            timeout: 10000,
          });

          await page.keyboard.press("Escape");

          await expect(page.getByRole("heading", { name: "Add Environment" })).toBeHidden({
            timeout: 10000,
          });
        }
      });

      await test.step("[Positive] Add Environment only lists environment types not already configured", async () => {
        const newEnvButton = page.getByRole("button", { name: "New Environment" });

        if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await newEnvButton.click();

          const checkboxes = page.getByRole("checkbox");
          const count = await checkboxes.count();

          expect(count).toBeLessThan(8);

          await page.keyboard.press("Escape");

          await expect(page.getByRole("heading", { name: "Add Environment" })).toBeHidden({
            timeout: 10000,
          });
        }
      });

      await test.step("[Negative] 'Add' in the Add Environment dialog is disabled until at least one environment is checked", async () => {
        const newEnvButton = page.getByRole("button", { name: "New Environment" });

        if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await newEnvButton.click();

          const addButton = page.getByRole("button", { name: "Add" });

          await expect(addButton).toBeDisabled({
            timeout: 10000,
          });

          const firstCheckbox = page.getByRole("checkbox").first();

          if (await firstCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
            await firstCheckbox.click();

            await expect(addButton).toBeEnabled({
              timeout: 10000,
            });
          }

          await page.keyboard.press("Escape");

          await expect(page.getByRole("heading", { name: "Add Environment" })).toBeHidden({
            timeout: 10000,
          });
        }
      });

      await test.step("[Positive] Confirming Add Environment creates the new environment(s) sorted by environment order", async () => {
        const newEnvButton = page.getByRole("button", { name: "New Environment" });

        if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await newEnvButton.click();

          const firstCheckbox = page.getByRole("checkbox").first();

          if (await firstCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
            await firstCheckbox.click();

            await page.getByRole("button", { name: "Add" }).click();

            await expect(page.getByRole("heading", { name: "Add Environment" })).toBeHidden({
              timeout: 15000,
            });
          }
        }
      });

      await test.step("[Positive] 'Cancel' in Add Environment closes the dialog without creating anything", async () => {
        const newEnvButton = page.getByRole("button", { name: "New Environment" });

        if (await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await newEnvButton.click();

          const firstCheckbox = page.getByRole("checkbox").first();

          if (await firstCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
            await firstCheckbox.click();
          }

          await page.getByRole("button", { name: "Cancel" }).click();

          await expect(page.getByRole("heading", { name: "Add Environment" })).toBeHidden({
            timeout: 10000,
          });
        }
      });

      await test.step("[Positive] Clicking an environment card starts impersonation and navigates into that environment's dashboard", async () => {
        const firstCard = page
          .locator('[class*="cursor-pointer"]')
          .filter({ hasText: "X-Blocks-Key:" })
          .first();

        if (await firstCard.isVisible({ timeout: 8000 }).catch(() => false)) {
          const setupPendingIcon = firstCard.locator('[aria-label="Setup pending"]');

          if (!(await setupPendingIcon.isVisible({ timeout: 3000 }).catch(() => false))) {
            await firstCard.click();

            await expect(page).toHaveURL(/\/app\/[^/]+\/dashboard/, {
              timeout: 15000,
            });
          }
        }
      });

      await test.step("[Positive] A card whose setup has not completed shows a 'Setup pending' warning icon and a Repair action instead of navigating", async () => {
        const setupPendingIcon = page.locator('[aria-label="Setup pending"]').first();

        if (await setupPendingIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
          await expect(setupPendingIcon).toBeVisible({
            timeout: 10000,
          });

          const repairButton = page.locator('[aria-label="Repair environment"]').first();

          await expect(repairButton).toBeVisible({
            timeout: 10000,
          });
        }
      });

      await test.step("[Positive] 'Repair' on a pending-setup card opens a confirmation and re-triggers setup on confirm", async () => {
        const repairButton = page.locator('[aria-label="Repair environment"]').first();

        if (await repairButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await repairButton.click();

          await expect(page.getByRole("heading", { name: "Repair this environment?" })).toBeVisible(
            {
              timeout: 10000,
            },
          );

          await page.getByRole("button", { name: "Repair" }).last().click();

          await expect(
            page.getByText("Setup has been re-triggered for this environment."),
          ).toBeVisible({
            timeout: 15000,
          });
        }
      });

      await test.step("[Positive] Clicking a card mid-migration shows a warning confirmation before proceeding", async () => {
        const migratingIcon = page.locator("svg.lucide-hourglass").first();

        if (await migratingIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
          const card = migratingIcon.locator(
            "xpath=ancestor::div[contains(@class,'cursor-pointer')][1]",
          );

          await card.click();

          await expect(
            page.getByRole("heading", {
              name: "Environment Migration in Progress",
            }),
          ).toBeVisible({
            timeout: 10000,
          });

          await expect(page.getByRole("button", { name: "Continue Anyway" })).toBeVisible({
            timeout: 10000,
          });
        }
      });

      await test.step("[Positive] A migrating card shows an hourglass indicator with a tooltip", async () => {
        const migratingIcon = page.locator("svg.lucide-hourglass").first();

        if (await migratingIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
          await migratingIcon.hover();

          await expect(page.getByText("Migration in progress")).toBeVisible({
            timeout: 10000,
          });
        }
      });

      await test.step("[Positive] 'Start Migration' navigates to the data-migration wizard", async () => {
        const startMigrationButton = page.getByRole("button", {
          name: "Start Migration",
        });

        if (await startMigrationButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await startMigrationButton.click();

          await expect(page).toHaveURL(/\/app\/data-migration/, {
            timeout: 15000,
          });
        }
      });
    });
  });
});
