import { test } from "../../support/test-base";
import {
  navigateToPermissionsFlow,
  openNewPermissionPageFlow,
  strictValidationFlow,
  createCustomPermissionFlow,
  openCustomPermissionDetailsFlow,
} from "../../pages/identity-and-access/permissions";

// Permissions flow: strict validation on New Permission, create a custom
// permission, and confirm it lands in the list tagged "Custom" before
// opening its own detail page.
test.describe("flows", () => {
  test("Permissions flow: strict validation -> create custom permission -> open its details", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Permissions", async () => {
      await navigateToPermissionsFlow(page);
    });

    await test.step("Open the New Permission page", async () => {
      await openNewPermissionPageFlow(page);
    });

    await test.step("Strict validation: Name, Type, Resource and Group are required", async () => {
      await strictValidationFlow(page);
    });

    const permissionName = `Flow Permission ${Date.now()}`;
    // Resource group rejects spaces server-side ("ResourceGroup must not
    // contain spaces.") — this is what silently blocked every previous
    // attempt at this flow (misdiagnosed as a backend mutation bug), not
    // a real product defect.
    const groupName = `flow-group-${Date.now()}`;

    await test.step("Fill a valid custom permission and save", async () => {
      await createCustomPermissionFlow(
        page,
        permissionName,
        `flow::resource::${Date.now()}`,
        "Endpoint",
        groupName,
        "High",
      );
    });

    await test.step("Find the new permission tagged 'Custom' and open its details", async () => {
      await openCustomPermissionDetailsFlow(page, permissionName);
    });
  });
});
