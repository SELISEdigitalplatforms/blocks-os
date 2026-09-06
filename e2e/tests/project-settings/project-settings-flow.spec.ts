import { test } from "../../support/test-base";
import { readOsProject, writeOsProject } from "../../support/os-project";
import {
  cancelEditProjectFlow,
  copyEnvironmentKeyFlow,
  navigateToProjectSettingsFlow,
  openEditProjectDialogFlow,
  renameProjectFlow,
  verifyEnvironmentsTableFlow,
  verifyGeneralInformationFlow,
  verifyNameValidationFlow,
  verifyNotDeployedBadgeFlow,
  verifyRenamedProjectVisibleFlow,
} from "../../pages/project-settings/project-settings";

test.describe("flows", () => {
  test("Project Settings flow: strict validation -> rename project -> Environments table", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const fixture = readOsProject();
    if (!fixture?.projectName) {
      throw new Error("Missing fixtures/os-project.json projectName — run os-setup first.");
    }
    let projectName = fixture.projectName;

    await test.step("Open Project Settings", async () => {
      await navigateToProjectSettingsFlow(page);
    });

    await test.step("General Information shows the current project name", async () => {
      await verifyGeneralInformationFlow(page, projectName);
    });

    await test.step("Open the Edit Project dialog", async () => {
      await openEditProjectDialogFlow(page, projectName);
    });

    await test.step("Cancel closes the dialog without saving", async () => {
      await cancelEditProjectFlow(page, projectName);
    });

    await test.step("Strict validation: name must be 3-100 characters", async () => {
      await verifyNameValidationFlow(page);
    });

    const baseProjectName = projectName.replace(/(?: Renamed)+$/, "");
    const renamedProject = `${baseProjectName} Renamed`;

    await test.step("Rename the project and save", async () => {
      await renameProjectFlow(page, renamedProject);
    });

    await test.step("The renamed project name is now shown", async () => {
      await verifyRenamedProjectVisibleFlow(page, renamedProject);
    });

    await test.step("Environments table lists the provisioned Development environment", async () => {
      await verifyEnvironmentsTableFlow(page);
    });

    await test.step("Copy the environment's X-Blocks-Key", async () => {
      await copyEnvironmentKeyFlow(page);
    });

    await test.step("Domain column shows 'Not deployed' for an undeployed environment", async () => {
      await verifyNotDeployedBadgeFlow(page);
    });

    projectName = renamedProject;
    writeOsProject({ ...fixture, projectName: renamedProject });
  });
});
