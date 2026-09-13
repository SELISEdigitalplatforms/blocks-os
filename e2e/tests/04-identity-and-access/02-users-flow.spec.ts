import { test } from "../../support/test-base";
import { uniqueTestEmail } from "../../support/env";
import {
  enableMultiOrgFlow,
  createOrganizationFlow,
} from "../../pages/identity-and-access/organizations";
import {
  navigateToUsersFlow,
  searchUsersFlow,
  filterByOrganizationThenRolesFlow,
  sortUsersByNameFlow,
  openInviteUserDialogFlow,
  inviteEmailValidationFlow,
  sendInviteFlow,
  openInvitedUserDetailsFlow,
  assertAccessTabLandingFlow,
  editUserNameFlow,
  rejectNonImageUploadFlow,
  rejectOversizedImageUploadFlow,
  uploadValidProfilePictureFlow,
  resendActivationFlow,
  manageUserRoleFlow,
  manageUserPermissionFlow,
  switchUserTabFlow,
  signOutSessionFlow,
  paginateHistoryListFlow,
} from "../../pages/identity-and-access/users";

// Users flow: enable multi-org + create a fresh org (idempotent — both
// helpers short-circuit when already enabled / already created), invite a
// user into that org, search/filter/sort the users list, then walk the
// user detail page (profile edit, avatar upload rules, resend activation,
// role/permission assignment, sessions sign-out, history pagination).
test.describe("flows", () => {
  test("Users flow: invite into org -> search/filter/sort -> details -> role/perm -> sessions/history", async ({
    page,
  }) => {
    test.setTimeout(360_000);

    await test.step("Enable multi-organization environment", async () => {
      await enableMultiOrgFlow(page);
    });

    const orgName = `Flow Org ${Date.now()}`;
    await test.step(`Create organization "${orgName}" to invite users into`, async () => {
      await createOrganizationFlow(page, orgName);
    });

    await test.step("Navigate to Users", async () => {
      await navigateToUsersFlow(page);
    });

    await test.step("Open the Invite User dialog", async () => {
      await openInviteUserDialogFlow(page);
    });

    await test.step("Strict validation: a valid Email is required", async () => {
      await inviteEmailValidationFlow(page);
    });

    const inviteEmail = uniqueTestEmail("flow-user");
    await test.step(`Invite a new user into organization "${orgName}"`, async () => {
      await sendInviteFlow(page, inviteEmail, orgName);
    });

    await test.step("Search filters the users list by name", async () => {
      await searchUsersFlow(page);
    });

    await test.step("Filters: select organization then Roles appears, then date filter", async () => {
      await filterByOrganizationThenRolesFlow(page, orgName);
    });

    await test.step("Sort by the Name column header", async () => {
      await sortUsersByNameFlow(page);
    });

    await test.step("Find the new user and open their details page", async () => {
      await openInvitedUserDetailsFlow(page, inviteEmail);
    });

    await test.step("Access tab is the default landing tab", async () => {
      await assertAccessTabLandingFlow(page);
    });

    await test.step("Edit the user's first and last name via the profile Edit dialog", async () => {
      await editUserNameFlow(page);
    });

    await test.step("Strict validation: a non-image file (PDF) is rejected", async () => {
      await rejectNonImageUploadFlow(page);
    });

    await test.step("Strict validation: an image over 5MB is rejected", async () => {
      await rejectOversizedImageUploadFlow(page);
    });

    await test.step("Upload a valid profile picture", async () => {
      await uploadValidProfilePictureFlow(page);
    });

    await test.step("Resend Activation via the user action menu (the user is still inactive)", async () => {
      await resendActivationFlow(page);
    });

    await test.step("Assign a role to the user via 'Manage Roles' on the Access tab", async () => {
      await manageUserRoleFlow(page);
    });

    await test.step("Assign a permission to the user via 'Manage Permissions' on the Access tab", async () => {
      await manageUserPermissionFlow(page);
    });

    await test.step("Navigate to the Sessions tab", async () => {
      await switchUserTabFlow(page, "Sessions");
    });

    await test.step("Sign out a session, if the invited (never-logged-in) user has any", async () => {
      await signOutSessionFlow(page);
    });

    await test.step("Navigate to the History tab", async () => {
      await switchUserTabFlow(page, "History");
    });

    await test.step("Paginate the History list, if more than one page exists", async () => {
      await paginateHistoryListFlow(page);
    });
  });
});