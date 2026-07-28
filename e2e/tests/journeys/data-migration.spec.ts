import { test } from "../../support/test-base";
import { expectDataMigrationVisible, openDataMigration } from "../../support/steps/account.steps";

test.describe("Data migration journey", () => {
  test("opens the data migration wizard", async ({ page }) => {
    await openDataMigration(page);
    await expectDataMigrationVisible(page);
  });
});
