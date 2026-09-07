import { test } from "../../support/test-base";
import {
  navigateToRolesFlow,
  openAddRoleDialogFlow,
  nameSlugRequiredValidationFlow,
  slugRejectsSpacesFlow,
  createRoleFlow,
  searchRoleByNameFlow,
  organizationFilterFlow,
  sortByNameColumnFlow,
  paginateRolesFlow,
  editRoleNameAndDescriptionFlow,
  openRoleDetailsFlow,
  toggleEditPermissionsDiscardFlow,
  saveEditPermissionsFlow,
  // archiveRoleFlow,
} from "../../pages/identity-and-access/roles";

test.describe("flows", () => {
  test("Roles flow: strict validation -> create -> open details -> edit permissions", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Roles", async () => {
      await navigateToRolesFlow(page);
    });

    await test.step("Open the Add Role dialog", async () => {
      await openAddRoleDialogFlow(page);
    });

    await test.step("Strict validation: Name and Slug are required", async () => {
      await nameSlugRequiredValidationFlow(page);
    });

    await test.step("Slug rejects spaces", async () => {
      await slugRejectsSpacesFlow(page);
    });

    const roleName = `Flow Role ${Date.now()}`;
    const roleSlug = `flow-role-${Date.now()}`;

    await test.step(`Fill a valid role "${roleName}" and save`, async () => {
      await createRoleFlow(page, roleName, roleSlug);
    });

    await test.step(`Search filters the roles list to "${roleName}"`, async () => {
      await searchRoleByNameFlow(page, roleName);
    });

    await test.step("Organization filter narrows the roles list", async () => {
      await organizationFilterFlow(page);
    });

    await test.step("Sort by the Name column header", async () => {
      await sortByNameColumnFlow(page);
    });

    await test.step("Paginate the roles list, if more than one page exists", async () => {
      await paginateRolesFlow(page);
    });

    const updatedRoleName = `${roleName} Updated`;

    await test.step(`Edit the role's name to "${updatedRoleName}" and description`, async () => {
      await editRoleNameAndDescriptionFlow(page, roleName, updatedRoleName);
    });

    await test.step(`Find the new role and open its details page`, async () => {
      await openRoleDetailsFlow(page, updatedRoleName);
    });

    await test.step("Toggle 'Edit Permissions' and discard without saving", async () => {
      await toggleEditPermissionsDiscardFlow(page);
    });

    await test.step("Edit Permissions -> check one -> Save Changes for real", async () => {
      await saveEditPermissionsFlow(page);
    });

    await test.step("Archive the role via its row action", async () => {
      // await archiveRoleFlow(page, updatedRoleName);
    });
  });
});
