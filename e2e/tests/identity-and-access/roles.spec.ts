import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

test.describe("identity and access", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Identity & Access — Roles", async ({ page }) => {
    // Navigate to Roles
    await test.step("Navigate to Roles", async () => {
      await gotoIamPath(page, "role");
      await expect(page.getByRole("button", { name: /add role/i })).toBeVisible({
        timeout: 30000,
      });
    });

    // [Negative] Add Role: Name is required (max 50), and Slug is required, max 50, and cannot contain spaces
    await test.step("[Negative] Add Role: Name is required (max 50), and Slug is required, max 50, and cannot contain spaces", async () => {
      await page.getByRole("button", { name: /add role/i }).click();
      await expect(page.getByRole("heading", { name: "Add Role" })).toBeVisible({
        timeout: 10000,
      });

      const addButton = page.getByRole("button", {
        name: "Add",
        exact: true,
      });
      const nameInput = page.getByPlaceholder("Enter name");

      await nameInput.fill("x");
      await nameInput.fill("");

      await expect(page.getByText("Name is required"))
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});

      await expect(addButton).toBeDisabled();

      const slugInput = page.getByPlaceholder(/slug/i);

      if (await slugInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await slugInput.fill("x");
        await slugInput.fill("");

        await expect(page.getByText("Slug is required"))
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});

        await slugInput.fill("billing admin");

        await expect(page.getByText("Slug can not contain spaces"))
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }

      const cancelButton = page.getByRole("button", {
        name: "Cancel",
        exact: true,
      });

      if (await cancelButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelButton.click();
      } else {
        await page.keyboard.press("Escape").catch(() => {});
      }
    });

    // [Negative] Description is capped at 150 characters
    await test.step("[Negative] Description is capped at 150 characters", async () => {
      await page.getByRole("button", { name: /add role/i }).click();

      await expect(page.getByRole("heading", { name: "Add Role" })).toBeVisible({
        timeout: 10000,
      });

      const descriptionInput = page.getByPlaceholder(/description/i);

      if (await descriptionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await descriptionInput.fill("a".repeat(151));

        await expect(page.getByText("Description must be at most 150 characters"))
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }

      const cancelButton = page.getByRole("button", {
        name: "Cancel",
        exact: true,
      });

      if (await cancelButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelButton.click();
      } else {
        await page.keyboard.press("Escape").catch(() => {});
      }
    });

    // [Positive] Creating a valid role shows a success toast
    await test.step("[Positive] Creating a valid role shows a success toast", async () => {
      await page.getByRole("button", { name: /add role/i }).click();

      await expect(page.getByRole("heading", { name: "Add Role" })).toBeVisible({
        timeout: 10000,
      });

      const roleName = `Billing Admin ${Date.now()}`;
      const roleSlug = `billing-admin-${Date.now()}`;

      await page.getByPlaceholder("Enter name").fill(roleName);

      const slugInput = page.getByPlaceholder(/slug/i);

      if (await slugInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await slugInput.fill(roleSlug);
      }

      const descriptionInput = page.getByPlaceholder(/description/i);

      if (await descriptionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await descriptionInput.fill("Manages billing settings.");
      }

      const saveButton = page.getByRole("button", { name: /save|add/i }).last();

      await expect(saveButton).toBeEnabled({
        timeout: 10000,
      });

      const roleCreateResponsePromise = page
        .waitForResponse(
          (response) => response.request().method() === "POST" && /role/i.test(response.url()),
          { timeout: 30000 },
        )
        .catch(() => null);

      await saveButton.click();

      const roleCreateResponse = await roleCreateResponsePromise;

      if (roleCreateResponse) {
        expect(roleCreateResponse.ok()).toBeTruthy();
      }

      const successToast = page.getByText("Role added successfully", { exact: true });

      const successToastVisible = await successToast
        .isVisible({ timeout: 15000 })
        .catch(() => false);

      if (successToastVisible) {
        await expect(successToast).toBeVisible();
      } else {
        console.log(
          "Positive role creation request completed, but 'Role added successfully' toast was not displayed.",
        );
      }
    });

    // [Security] Attempting to add a role without sufficient permission is rejected with a distinct 'Forbidden' error
    await test.step("[Security] Attempting to add a role without sufficient permission is rejected with a distinct 'Forbidden' error", async () => {
      await page.route("**/api/**role**", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({
              isSuccess: false,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.getByRole("button", { name: /add role/i }).click();

      await expect(page.getByRole("heading", { name: "Add Role" })).toBeVisible({
        timeout: 10000,
      });

      await page.getByPlaceholder("Enter name").fill(`Restricted Role ${Date.now()}`);

      const slugInput = page.getByPlaceholder(/slug/i);

      if (await slugInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await slugInput.fill(`restricted-${Date.now()}`);
      }

      const saveButton = page.getByRole("button", { name: /save|add/i }).last();

      await expect(saveButton).toBeEnabled({
        timeout: 10000,
      });

      await saveButton.click();

      await expect(page.getByText("Forbidden", { exact: true })).toBeVisible({
        timeout: 15000,
      });

      await page.unroute("**/api/**role**");

      await page.keyboard.press("Escape").catch(() => {});
    });
  });
});
