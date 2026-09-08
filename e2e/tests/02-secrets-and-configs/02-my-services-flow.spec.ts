import { test } from "../../support/test-base";
import {
  copyServiceIdAndKeyFlow,
  expandServiceRowAndVerifyFlow,
  navigateToMyServicesFlow,
  openDocsInNewTabFlow,
  openRegisterServiceDialogFlow,
  openServiceScopedLogsFlow,
  openSetupGuideFlow,
  registerFrontendServiceFlow,
  registerServiceFlow,
  verifyEmptyStateFlow,
  verifyNavAwayFromMyServicesFlow,
  verifySaveDisabledFlow,
  verifyServiceNameMaxLengthFlow,
} from "../../pages/secrets-and-configs/my-services";

test.describe("flows", () => {
  test("My Services flow: strict validation -> register -> expand details -> setup guide", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to My Services", async () => {
      await navigateToMyServicesFlow(page);
    });

    await test.step("A fresh project starts with no registered services", async () => {
      await verifyEmptyStateFlow(page);
    });

    await test.step("Open the Register Service dialog", async () => {
      await openRegisterServiceDialogFlow(page);
    });

    await test.step("'Save' stays disabled until the form is dirty and valid", async () => {
      await verifySaveDisabledFlow(page);
    });

    await test.step("Strict validation: Service Name has a 100-character max", async () => {
      await verifyServiceNameMaxLengthFlow(page);
    });

    const serviceName = `Flow Service ${Date.now()}`;

    await test.step("Fill Service Name, select a Type, then save", async () => {
      await registerServiceFlow(page, serviceName, "Backend");
    });

    let serviceTrigger: Awaited<ReturnType<typeof expandServiceRowAndVerifyFlow>>;
    await test.step("Find the new service and expand its accordion row", async () => {
      serviceTrigger = await expandServiceRowAndVerifyFlow(page, serviceName);
    });

    await test.step("Copy Service ID and X-Blocks-Key to the clipboard", async () => {
      await copyServiceIdAndKeyFlow(page);
    });

    await test.step("'Logs' button navigates away from My Services", async () => {
      await verifyNavAwayFromMyServicesFlow(page, "Logs");
    });

    await test.step("'Traces' button navigates away from My Services", async () => {
      await verifyNavAwayFromMyServicesFlow(page, "Traces");
    });

    await test.step("'Docs' opens the external documentation site in a new tab", async () => {
      if (
        !(await page.getByText("Service ID").first().isVisible({ timeout: 3000 }))
      ) {
        await serviceTrigger.click();
      }
      await openDocsInNewTabFlow(page);
    });

    await test.step("Open the Setup Guide panel", async () => {
      await openSetupGuideFlow(page);
    });

    const frontendServiceName = `Flow Frontend Service ${Date.now()}`;

    await test.step("Register a second service as Frontend type", async () => {
      await registerFrontendServiceFlow(page, frontendServiceName);
    });

    await test.step("'Logs' button on a service card should open that service's scoped log view", async () => {
      await navigateToMyServicesFlow(page);
      await openRegisterServiceDialogFlow(page);
      const regressionName = `Flow Regression Service ${Date.now()}`;
      await registerServiceFlow(page, regressionName, "Backend");
      await openServiceScopedLogsFlow(page, regressionName);
    });
  });
});
