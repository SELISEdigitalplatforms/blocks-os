import { test } from "../../support/test-base";
import {
  enableMultiOrgFlow,
  verifyAddOrgButtonEnabledFlow,
  nameMaxLengthValidationFlow,
  createOrganizationFlow,
  selectOrgInSidebarFlow,
  verifyMembersTabFlow,
  renameOrganizationFlow,
  disableReEnableOrganizationFlow,
  searchOrganizationsFlow,
  statusFilterFlow,
} from "../../pages/identity-and-access/organizations";

test.describe("organizations-flows", () => {
  test("Organizations flow: strict validation -> create -> select in sidebar -> workspace panel", async ({
    page,
  }) => {
    test.setTimeout(180_000);

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
