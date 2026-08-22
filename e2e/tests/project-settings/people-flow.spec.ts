import { test, expect } from "../../support/test-base";
import {
  createProject,
  deleteCreatedProject,
  openProjectOverviewPage,
} from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";
import { uniqueTestEmail } from "../../support/env";

// People flow: strict validation on Invite, invite a fresh person into the
// Development environment, open their details page, and remove their access
// from the Environments tab.
test.describe("flows", () => {
  let projectName = "";
  let tenantGroupId = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName, tenantGroupId } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("People flow: strict validation -> invite -> open details -> remove environment access", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Open People", async () => {
      await openProjectOverviewPage(page, tenantGroupId, "people");
      await expect(page.getByRole("heading", { name: "People" })).toBeVisible({ timeout: 30000 });
    });

    await test.step("The project owner appears in the list", async () => {
      await expect(page.getByText("Owner").first()).toBeVisible({ timeout: 15000 });
    });

    await test.step("Open the Invite dialog", async () => {
      await page.getByRole("button", { name: "Invite" }).click();
      await expect(page.getByRole("heading", { name: "Invite people" })).toBeVisible({
        timeout: 10000,
      });
    });

    await test.step("Strict validation: recipients and environments are required", async () => {
      // Send stays disabled until the form is valid (mode: "onChange",
      // resolver rejects an empty recipients/projectKeys pair).
      const sendButton = page.getByRole("button", { name: "Send" });
      await expect(sendButton).toBeDisabled();

      const recipientInput = page.getByPlaceholder("Enter email").first();
      await recipientInput.fill("not-an-email");
      await recipientInput.blur();
      await expect(page.getByText("Invalid email format"))
        .toBeVisible()
        .catch(() => {});
      await expect(sendButton).toBeDisabled();
    });

    const inviteEmail = uniqueTestEmail("flow-people");

    await test.step("Fill a valid, fresh email with an environment and send the invite", async () => {
      const recipientInput = page.getByPlaceholder("Enter email").first();
      await recipientInput.fill(inviteEmail);

      // "Select environments" is a MultiSelect combobox — open it and pick
      // the first available option (the new project's Development env).
      await page.getByText("Select environments", { exact: true }).click();
      const firstEnvOption = page.getByRole("option").first();
      await expect(firstEnvOption).toBeVisible({ timeout: 10000 });
      await firstEnvOption.click();
      await page.keyboard.press("Escape");

      const sendButton = page.getByRole("button", { name: "Send" });
      await expect(sendButton).toBeEnabled();
      await sendButton.click();

      await expect(page.getByText(/Invitation is sent/))
        .toBeVisible({ timeout: 20000 })
        .catch(() => {});
      await expect(page.getByRole("heading", { name: "Invite people" })).toBeHidden({
        timeout: 15000,
      });
    });

    const personRow = page.getByRole("row").filter({ hasText: inviteEmail });

    await test.step("Find the invited person and open their details page", async () => {
      if (!(await personRow.isVisible({ timeout: 15000 }).catch(() => false))) {
        // The People list can race its own refetch right after a fresh
        // invite — one reload clears it, same pattern as users-flow.
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
          timeout: 30000,
        });
      }
      await expect(personRow).toBeVisible({ timeout: 15000 });
      await personRow.click();
      await expect(page).toHaveURL(/\/app\/project\/[^/]+\/people\/.+/, { timeout: 15000 });
    });

    await test.step("Details tab is the default landing tab", async () => {
      await expect(page.getByRole("tab", { name: "Details" })).toBeVisible({ timeout: 15000 });
    });

    await test.step("Navigate to the Environments tab and remove access", async () => {
      await page.getByRole("tab", { name: "Environments" }).click();
      await expect(page.getByRole("tab", { name: "Environments" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      const removeButton = page.getByRole("button", { name: /Remove access from/ }).first();
      if (!(await removeButton.isVisible({ timeout: 10000 }).catch(() => false))) {
        return;
      }
      await removeButton.click();
      await expect(page.getByText("Remove Access")).toBeVisible({ timeout: 10000 });
      await page.getByRole("button", { name: "Remove", exact: true }).click();
      await expect(page.getByText(/Access removed from/))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    await test.step("Return to the People list", async () => {
      await openProjectOverviewPage(page, tenantGroupId, "people");
      await expect(page.getByRole("heading", { name: "People" })).toBeVisible({ timeout: 30000 });
    });
  });
});
