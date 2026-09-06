import { test } from "../../support/test-base";
import { openOsDashboard } from "../../support/os-helpers";
import {
  copyDomainFromRowFlow,
  deleteDomainFlow,
  fillAndSaveDomainFlow,
  filterDomainsBySearchFlow,
  openAddDomainDialogFlow,
  openBootstrapBriefFlow,
  openConfigureDomainDialogFlow,
  paginateDomainsFlow,
  validateDomainCnameFlow,
  verifyAddDomainDisabledAndValidationFlow,
  verifyConsolePageResourceLinksFlow,
  verifyDomainRowActionsFlow,
  verifyDomainsSectionPresentFlow,
  verifyNewDomainAppearsAsUnverifiedFlow,
  verifyProjectDeleteButtonVisibleFlow,
  verifyProjectHeaderAndKeyFlow,
  verifyRepositoriesSectionPresentFlow,
  openAppsSwitcherFlow,
  openNotificationsPanelFlow,
  openUserMenuAndNavigateToProfileFlow,
  toggleThemeSwitcherFlow,
  verifyLanguageSwitcherFlow,
} from "../../pages/overview";

test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await openOsDashboard(page);
  });

  test("Overview flow: project header -> bootstrap -> strict domain validation -> add -> delete domain", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Land on the Overview (dashboard) page with project header and key", async () => {
      await verifyProjectHeaderAndKeyFlow(page);
    });

    const dashboardUrl = page.url();

    await test.step("Theme switcher toggles between Auto, Light and Dark", async () => {
      await toggleThemeSwitcherFlow(page);
    });

    await test.step("Language switcher offers language options", async () => {
      await verifyLanguageSwitcherFlow(page);
    });

    await test.step("'SELISE Blocks apps' opens the app switcher with sibling apps listed", async () => {
      await openAppsSwitcherFlow(page);
    });

    await test.step("Notification bell opens the notifications panel", async () => {
      await openNotificationsPanelFlow(page);
    });

    await test.step("'Open user menu' -> 'My Profile' navigates to the Profile page", async () => {
      await openUserMenuAndNavigateToProfileFlow(page, dashboardUrl);
    });

    await test.step("Console page's Resource links point to the right external URLs", async () => {
      await verifyConsolePageResourceLinksFlow(page, dashboardUrl);
    });

    await test.step("Bootstrap action opens the AI-agent bootstrap brief", async () => {
      await openBootstrapBriefFlow(page);
    });

    await test.step("Delete action (project owner) is visible on Overview", async () => {
      await verifyProjectDeleteButtonVisibleFlow(page);
    });

    await test.step("Domains section is present", async () => {
      await verifyDomainsSectionPresentFlow(page);
    });

    await test.step("Open 'Add Domain' dialog", async () => {
      await openAddDomainDialogFlow(page);
    });

    await test.step("'Add' stays disabled until Domain and Cookie Domain are valid", async () => {
      await verifyAddDomainDisabledAndValidationFlow(page);
    });

    const domainName = `flow-${Date.now()}.example.com`;

    await test.step("Fill a valid domain (cookie domain auto-derives) and save", async () => {
      await fillAndSaveDomainFlow(page, domainName);
    });

    let domainRow: Awaited<ReturnType<typeof verifyNewDomainAppearsAsUnverifiedFlow>>;
    await test.step("New domain appears in the table as Unverified", async () => {
      domainRow = await verifyNewDomainAppearsAsUnverifiedFlow(page, domainName);
    });

    await test.step("Unverified domain offers Configure and Validate CNAME actions", async () => {
      await verifyDomainRowActionsFlow(page, domainRow);
    });

    await test.step("Copying the domain and cookie domain values works", async () => {
      await copyDomainFromRowFlow(page, domainRow);
    });

    await test.step("'Configure domain' opens the pre-filled Edit Domain dialog", async () => {
      await openConfigureDomainDialogFlow(page, domainRow, domainName);
    });

    await test.step("'Validate CNAME' runs a real lookup against the unverified domain", async () => {
      await validateDomainCnameFlow(page, domainName);
    });

    await test.step("Domain search filter narrows the table", async () => {
      await filterDomainsBySearchFlow(page, domainName);
    });

    await test.step("Domain table pagination controls appear once there's more than a page", async () => {
      await paginateDomainsFlow(page, domainName);
    });

    await test.step("Delete the domain via its confirmation dialog", async () => {
      await deleteDomainFlow(page, domainName);
    });

    await test.step("Repositories section is present below Domains", async () => {
      await verifyRepositoriesSectionPresentFlow(page);
    });
  });
});
