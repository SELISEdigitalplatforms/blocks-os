import { test, expect } from "../../support/test-base";
import {
  ErrorWatch,
  SECRET_ACCESS_URL,
  allowedUsersBlock,
  SECRET_NAME_PREFIX,
  archiveSpecSecrets,
  createSecretWithMissingUser,
  expandAndAwaitUserLookup,
  findSecretRow,
  newMissingUserId,
  openEditDialog,
  reloadSecretList,
} from "../../pages/secrets-and-configs/missing-user-765";

// os#765 — a missing user in the IAM user-by-id lookup (spec §10, criteria 8.2, 8.3 and 9.1, D2-D4
// are unit-tested). A secret whose access list holds an id IAM has no user for shows that raw id,
// can remove it and save, and the page raises no TypeError and no Rollbar report.
// How the missing user is made: see pages/secrets-and-configs/missing-user-765.ts.

test.describe("flows", () => {
  test("#765 §10 8.2 8.3 9.1: secret access list with a missing user shows the raw id, removes it and saves", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const watch = new ErrorWatch(page);
    const missingUserId = newMissingUserId();
    const secretName = `${SECRET_NAME_PREFIX}${Date.now()}`;

    await test.step("Create an Application secret whose access list holds a user IAM does not have", async () => {
      const type = await createSecretWithMissingUser(page, secretName, missingUserId);
      expect(type, "the Create dialog defaults to an Application secret").toMatch(/api/i);
    });

    await test.step("Open the secret: IAM answers 200 with no user (A1) and the row shows the raw id", async () => {
      await reloadSecretList(page);
      const row = await findSecretRow(page, secretName);
      const lookup = await expandAndAwaitUserLookup(page, row, missingUserId);
      expect(lookup.status(), "IAM answers an unknown id with 200 (spec A1)").toBe(200);
      const body = (await lookup.json().catch(() => ({}))) as { data?: unknown };
      expect(body.data ?? null, "IAM sends no user for the id").toBeNull();

      const allowedUsers = allowedUsersBlock(page);
      await expect(allowedUsers.getByText(missingUserId, { exact: true })).toBeVisible();
    });

    await test.step("Edit: the raw id is a chip with a working Remove action; removing it and saving succeeds", async () => {
      const dialog = await openEditDialog(page, secretName);
      await expect(dialog.getByText(missingUserId, { exact: true })).toBeVisible({ timeout: 15_000 });
      const remove = dialog.getByRole("button", { name: `Remove ${missingUserId}` });
      await expect(remove).toBeEnabled();
      await remove.click();
      await expect(dialog.getByText(missingUserId, { exact: true })).toBeHidden();
      await expect(dialog.getByText("No one added yet.")).toBeVisible();

      const saved = page.waitForResponse(
        (response) =>
          SECRET_ACCESS_URL.test(response.url()) && response.request().method() === "POST",
      );
      await dialog.getByRole("button", { name: "Save" }).click();
      const response = await saved;
      expect(response.ok(), `access update answered ${response.status()}`).toBeTruthy();
      const sent = JSON.parse(response.request().postData() ?? "{}");
      expect(sent.access?.userIds ?? null).toEqual([]);
      await expect(dialog).toBeHidden({ timeout: 15_000 });
    });

    await test.step("The saved secret has no allowed users left", async () => {
      await reloadSecretList(page);
      const row = await findSecretRow(page, secretName);
      await row.click();
      const allowedUsers = allowedUsersBlock(page);
      await expect(allowedUsers).toBeVisible({ timeout: 15_000 });
      await expect(allowedUsers.getByText("None", { exact: true })).toBeVisible();
      await expect(allowedUsers.getByText(missingUserId, { exact: true })).toBeHidden();
    });

    await test.step("No TypeError in the console and no Rollbar report for the lookup (9.1)", async () => {
      expect(watch.crashMessages(), "console/page errors naming the crash").toEqual([]);
      expect(watch.rollbarReportsFor(missingUserId), "Rollbar reports for the lookup").toEqual([]);
    });

    await test.step("Clean up: archive the test secret", async () => {
      await archiveSpecSecrets(page);
    });
  });
});
