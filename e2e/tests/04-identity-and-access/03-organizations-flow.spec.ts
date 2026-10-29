import { test } from "../../support/test-base";
import { uniqueTestEmail } from "../../support/env";
import {
  enableMultiOrgFlow,
  verifyAddOrgButtonEnabledFlow,
  nameMaxLengthValidationFlow,
  createOrganizationFlow,
  selectOrgInSidebarFlow,
  verifyMembersTabFlow,
  inviteOrgMemberFlow,
  renameOrganizationFlow,
  disableReEnableOrganizationFlow,
  searchOrganizationsFlow,
  statusFilterFlow,
} from "../../pages/identity-and-access/organizations";

// Organizations flow: enable multi-org -> max-length validation -> create ->
// Members tab -> invite a member -> rename -> disable/re-enable -> search ->
// status filter. Self-contained: it enables multi-org and creates its own org
// so it can run before or after 02-users-flow without sharing state.
test.describe("flows", () => {
  test("Organizations flow: enable multi-org -> create -> members -> rename -> disable/re-enable -> search -> filter", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await test.step("Enable multi-organization environment", async () => {
      await enableMultiOrgFlow(page);
    });

    await test.step("Verify Add Organization button is enabled", async () => {
      await verifyAddOrgButtonEnabledFlow(page);
    });

    await test.step("Name max-length validation rejects 101 characters", async () => {
      await nameMaxLengthValidationFlow(page);
    });

    let orgName = `Flow Org ${Date.now()}`;
    await test.step(`Create organization "${orgName}"`, async () => {
      await createOrganizationFlow(page, orgName);
    });

    await test.step("Select the new organization in the sidebar", async () => {
      await selectOrgInSidebarFlow(page, orgName);
    });

    await test.step("Verify Members tab shows Invite action", async () => {
      await verifyMembersTabFlow(page);
    });

    const orgMemberEmail = uniqueTestEmail("flow-org-member");
    await test.step("Invite a member from the organization (send invitation only)", async () => {
      await inviteOrgMemberFlow(page, orgMemberEmail, orgName);
    });

    orgName = await test.step(`Rename organization to "${orgName} Renamed"`, async () => {
      return await renameOrganizationFlow(page, orgName);
    });

    await test.step("Disable then re-enable the organization", async () => {
      await disableReEnableOrganizationFlow(page);
    });

    await test.step("Search organizations honors 3-char minimum and filters", async () => {
      await searchOrganizationsFlow(page, orgName);
    });

    await test.step("Status filter narrows the sidebar list", async () => {
      await statusFilterFlow(page, orgName);
    });
  });
});