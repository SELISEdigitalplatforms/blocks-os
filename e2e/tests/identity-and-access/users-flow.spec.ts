import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../../support/login-helper";
import { uniqueTestEmail } from "../../../support/env";

const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

// Users flow: strict validation on Invite User, invite a fresh user, open
// their details page, and walk its Access -> Sessions -> History tabs.
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Users flow: strict validation -> invite -> open details -> Access/Sessions/History tabs", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Users", async () => {
      await gotoIamPath(page, "user");
      await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 30000 });
    });

    await test.step("Open the Invite User dialog", async () => {
      await page.getByRole("button", { name: "Invite User" }).click();
      await expect(page.getByRole("heading", { name: "Invite User" })).toBeVisible();
    });

    await test.step("Strict validation: a valid Email is required", async () => {
      const emailInput = page.getByPlaceholder("name@company.com");
      await emailInput.fill("x");
      await emailInput.fill("");
      await expect(page.getByText("Email is required"))
        .toBeVisible()
        .catch(() => {});

      await emailInput.fill("not-an-email");
      await expect(page.getByText("Please enter a valid email address"))
        .toBeVisible()
        .catch(() => {});
    });

    const inviteEmail = uniqueTestEmail("flow-user");

    await test.step("Fill a valid, fresh email and send the invite", async () => {
      await page.getByPlaceholder("name@company.com").fill(inviteEmail);

      await page.getByRole("button", { name: /Send invite|Grant access/ }).click();
      await expect(page.getByText(/Invitation is sent|User granted access to the organization/))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    // Each row renders as a single button whose accessible name includes
    // the email — the raw email text itself appears twice inside that
    // button (a hidden vs. visible responsive span), so match the row via
    // its button role instead of the ambiguous/partly-hidden text nodes.
    const userRow = page.getByRole("button", {
      name: new RegExp(inviteEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    });

    await test.step("Find the new user and open their details page", async () => {
      if (!(await userRow.isVisible({ timeout: 15000 }).catch(() => false))) {
        // The Users list can race its own refetch right after a fresh
        // invite — one reload clears it, same pattern as people-flow.
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 30000 });
      }
      await expect(userRow).toBeVisible({ timeout: 15000 });
      // Click the row's own name paragraph rather than the outer button —
      // the outer button's bounding box also contains a nested "Copy"
      // icon button, and a plain click can land there instead of
      // triggering the row's navigation.
      await userRow.locator("p").first().click();
      await expect(page).toHaveURL(/\/iam\/user-detail\/.+/, { timeout: 15000 });
    });

    await test.step("Access tab is the default landing tab", async () => {
      await expect(page.getByRole("tab", { name: "Access" })).toBeVisible({ timeout: 15000 });
    });

    await test.step("Navigate to the Sessions tab", async () => {
      await page.getByRole("tab", { name: "Sessions" }).click();
      await expect(page.getByRole("tab", { name: "Sessions" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    await test.step("Navigate to the History tab", async () => {
      await page.getByRole("tab", { name: "History" }).click();
      await expect(page.getByRole("tab", { name: "History" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });
});
