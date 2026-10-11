import { test } from "../../support/test-base";
import { uniqueTestEmail } from "../../support/env";
import {
  enableMultiOrgFlow,
  createOrganizationFlow,
  selectOrgInSidebarFlow,
} from "../../pages/identity-and-access/organizations";
import {
  inviteNewMemberHidesNotifyFlow,
  grantExistingMemberFlow,
  revokeMemberFromOrganizationFlow,
  openMemberDetailFlow,
  removeMembershipFromUserDetailFlow,
} from "../../pages/identity-and-access/organization-membership-notify";

// "Notify user by email" on organization membership changes. The box is
// offered only when an existing account is added or removed, is ticked by
// default, and its value reaches IAM as `notifyUser`. Self-contained: it
// enables multi-org and creates its own two organizations.
test.describe("flows", () => {
  test("Organization membership notify: new invite hides it -> grant notifies -> revoke opt-out -> grant opt-out -> remove notifies", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    await test.step("Enable multi-organization environment", async () => {
      await enableMultiOrgFlow(page);
    });

    const stamp = Date.now();
    const firstOrg = `Notify Org A ${stamp}`;
    const secondOrg = `Notify Org B ${stamp}`;

    await test.step(`Create organizations "${firstOrg}" and "${secondOrg}"`, async () => {
      await createOrganizationFlow(page, firstOrg);
      await createOrganizationFlow(page, secondOrg);
    });

    const memberEmail = uniqueTestEmail("notify-org-member");

    await test.step("Inviting a brand-new email does not offer the notify choice", async () => {
      await selectOrgInSidebarFlow(page, firstOrg);
      await inviteNewMemberHidesNotifyFlow(page, memberEmail, firstOrg);
    });

    await test.step("Adding the existing user to another org sends notifyUser=true by default", async () => {
      await selectOrgInSidebarFlow(page, secondOrg);
      await grantExistingMemberFlow(page, memberEmail, secondOrg, true);
    });

    await test.step("Revoking with the box unticked sends notifyUser=false", async () => {
      await revokeMemberFromOrganizationFlow(page, memberEmail, false);
    });

    await test.step("Re-adding with the box unticked sends notifyUser=false", async () => {
      await grantExistingMemberFlow(page, memberEmail, secondOrg, false);
    });

    await test.step("Removing from the user detail page sends notifyUser=true by default", async () => {
      await openMemberDetailFlow(page, memberEmail);
      await removeMembershipFromUserDetailFlow(page, secondOrg);
    });
  });
});
