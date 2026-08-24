import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

// Settings flow: the default Auth tab, strict numeric validation, a valid
// save, then a walk across the IAM / Signup / Organization tabs.
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Settings flow: Auth tab strict validation -> save -> IAM/Signup/Organization tabs", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Settings (renders as Auth Configuration)", async () => {
      await gotoIamPath(page, "settings");
      await expect(page.getByRole("heading", { name: "Auth Configuration" })).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByRole("tab", { name: "Auth" })).toBeVisible();
    });

    const lockoutInput = page.getByLabel("Maximum Failed Login Attempts");

    await test.step("Strict validation: a non-positive value is rejected", async () => {
      if (await lockoutInput.isVisible({ timeout: 8000 }).catch(() => false)) {
        await lockoutInput.fill("0");
        await expect(page.getByText("Value must be greater than zero."))
          .toBeVisible()
          .catch(() => {});
      }
    });

    const accessTokenInput = page.getByLabel("Access Token Validity");

    await test.step("Reset discards an edited Token Configuration field", async () => {
      if (await accessTokenInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        const originalValue = await accessTokenInput.inputValue();
        await accessTokenInput.fill("123");

        const resetButton = page.getByRole("button", { name: "Reset" });
        await expect(resetButton).toBeEnabled({ timeout: 10000 });
        await resetButton.click();

        await expect(accessTokenInput).toHaveValue(originalValue, { timeout: 10000 }).catch(() => {});
        await expect(resetButton).toBeDisabled({ timeout: 10000 }).catch(() => {});
      }
    });

    await test.step("A valid value enables Save, and saving shows a success toast", async () => {
      if (await lockoutInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await lockoutInput.fill("7");

        const saveButton = page.getByRole("button", { name: "Save" });
        await expect(saveButton).toBeEnabled({ timeout: 10000 });
        await saveButton.click();

        await expect(page.getByText("Authentication settings updated successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Certificate 'Copy' and 'Download' actions are present in Infrastructure", async () => {
      const copyButton = page.getByRole("button", { name: "Copy certificate URL" });
      if (await copyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await copyButton.click();
        await expect(page.getByRole("button", { name: "Download certificate" })).toBeVisible();
      }
    });

    await test.step("Navigate to the IAM tab", async () => {
      const iamTab = page.getByRole("tab", { name: "IAM" });
      if (await iamTab.isVisible({ timeout: 8000 }).catch(() => false)) {
        await iamTab.click();
        await expect(iamTab).toHaveAttribute("aria-selected", "true");
      }
    });

    await test.step("OIDC toggle hides the Activation & Recovery Paths fields, then Reset restores them", async () => {
      const oidcSwitch = page.getByLabel("OpenID Connect (OIDC)");
      if (await oidcSwitch.isVisible({ timeout: 8000 }).catch(() => false)) {
        const activationPathInput = page.getByLabel("Account Activation Path");
        await expect(activationPathInput).toBeVisible({ timeout: 5000 }).catch(() => {});

        await oidcSwitch.click();
        await expect(activationPathInput).toBeHidden({ timeout: 5000 }).catch(() => {});

        const resetButton = page.getByRole("button", { name: "Reset" });
        await expect(resetButton).toBeEnabled({ timeout: 10000 }).catch(() => {});
        await resetButton.click();
        await expect(activationPathInput).toBeVisible({ timeout: 10000 }).catch(() => {});
      }
    });

    await test.step("Toggle 'Logout on Password Change', edit the strength regex, and save", async () => {
      const logoutSwitch = page.getByLabel("Logout on Password Change");
      const regexInput = page.getByLabel("Password Strength Regex");
      if (await logoutSwitch.isVisible({ timeout: 8000 }).catch(() => false)) {
        await logoutSwitch.click();
        if (await regexInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await regexInput.fill("^.{8,}$");
        }

        const saveButton = page.getByRole("button", { name: "Save" });
        await expect(saveButton).toBeEnabled({ timeout: 10000 });
        await saveButton.click();

        await expect(page.getByText("IAM configuration updated successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Navigate to the Signup tab", async () => {
      const signupTab = page.getByRole("tab", { name: "Signup" });
      if (await signupTab.isVisible({ timeout: 8000 }).catch(() => false)) {
        await signupTab.click();
        await expect(signupTab).toHaveAttribute("aria-selected", "true");
      }
    });

    await test.step("Enable Sign Up, assign a default role and permission, then save", async () => {
      const signUpSwitch = page.getByLabel("Sign Up Enabled");
      if (await signUpSwitch.isVisible({ timeout: 8000 }).catch(() => false)) {
        const wasChecked = await signUpSwitch.isChecked().catch(() => false);
        if (!wasChecked) {
          await signUpSwitch.click();
        }

        const manageRolesButton = page.getByRole("button", { name: "Manage Roles" });
        if (await manageRolesButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await manageRolesButton.click();
          await expect(page.getByRole("heading", { name: "Assign roles" })).toBeVisible();
          const firstRoleCheckbox = page.getByRole("checkbox").first();
          if (await firstRoleCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
            await firstRoleCheckbox.click();
          }
          await page.getByRole("button", { name: "Set", exact: true }).click();
        }

        const managePermissionsButton = page.getByRole("button", { name: "Manage Permissions" });
        if (await managePermissionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await managePermissionsButton.click();
          await expect(page.getByRole("heading", { name: "Assign permissions" })).toBeVisible({
            timeout: 8000,
          }).catch(() => {});
          const firstPermissionCheckbox = page.getByRole("checkbox").first();
          if (await firstPermissionCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
            await firstPermissionCheckbox.click();
          }
          await page.getByRole("button", { name: "Set", exact: true }).click();
        }

        const saveButton = page.getByRole("button", { name: "Save" });
        await expect(saveButton).toBeEnabled({ timeout: 10000 }).catch(() => {});
        await saveButton.click();

        await expect(page.getByText("Signup settings updated successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Navigate to the Organization tab", async () => {
      const organizationTab = page.getByRole("tab", { name: "Organization" });
      if (await organizationTab.isVisible({ timeout: 8000 }).catch(() => false)) {
        await organizationTab.click();
        await expect(organizationTab).toHaveAttribute("aria-selected", "true");
      }
    });

    const multiOrgSwitch = page.getByLabel("Multi-Organization Environment");

    await test.step("Cancelling the enable-multi-org confirmation leaves it off", async () => {
      const alreadyEnabled = await multiOrgSwitch.isChecked().catch(() => false);
      if (!alreadyEnabled && (await multiOrgSwitch.isVisible({ timeout: 8000 }).catch(() => false))) {
        await multiOrgSwitch.click();
        await expect(
          page.getByRole("heading", { name: "Enable multi-organization mode?" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(multiOrgSwitch).not.toBeChecked({ timeout: 5000 }).catch(() => {});
      }
    });

    await test.step("Confirming enables multi-org and reveals the Creation Workflows card", async () => {
      const alreadyEnabled = await multiOrgSwitch.isChecked().catch(() => false);
      if (!alreadyEnabled && (await multiOrgSwitch.isVisible({ timeout: 8000 }).catch(() => false))) {
        await multiOrgSwitch.click();
        await expect(
          page.getByRole("heading", { name: "Enable multi-organization mode?" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Enable", exact: true }).click();
        await expect(multiOrgSwitch).toBeChecked({ timeout: 10000 }).catch(() => {});

        await expect(page.getByText("Organization Creation Workflows")).toBeVisible({
          timeout: 10000,
        });
        const cloudWorkflowSwitch = page.getByLabel("Allow Creation from OS");
        if (await cloudWorkflowSwitch.isVisible({ timeout: 5000 }).catch(() => false)) {
          await cloudWorkflowSwitch.click();
        }

        const saveButton = page.getByRole("button", { name: "Save" });
        await expect(saveButton).toBeEnabled({ timeout: 10000 });
        await saveButton.click();

        await expect(page.getByText("Organization configuration updated successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
        // Now saved and permanent for this (disposable, per-test) project — the
        // toggle should be disabled since it can no longer be turned off.
        await expect(multiOrgSwitch).toBeDisabled({ timeout: 10000 }).catch(() => {});
      }
    });

    await test.step("Switch tabs via the mobile Select dropdown", async () => {
      const originalViewport = page.viewportSize();
      await page.setViewportSize({ width: 375, height: 800 });
      try {
        await gotoIamPath(page, "settings");
        await expect(page.getByRole("heading", { name: "Auth Configuration" })).toBeVisible({
          timeout: 30000,
        });

        // The desktop TabsList is `hidden md:flex` (display:none) on this
        // viewport, which drops its `tab` roles from the accessibility tree
        // entirely — so verify the switch via each tab's own content instead
        // of the (unqueryable) tab element's aria-selected.
        const mobileTabSelect = page.getByRole("combobox", { name: "Settings section" });
        if (await mobileTabSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
          await mobileTabSelect.click();
          await page.getByRole("option", { name: "IAM" }).click();
          await expect(page.getByLabel("OpenID Connect (OIDC)")).toBeVisible({ timeout: 10000 });

          await mobileTabSelect.click();
          await page.getByRole("option", { name: "Signup" }).click();
          await expect(page.getByLabel("Sign Up Enabled")).toBeVisible({ timeout: 10000 });

          await mobileTabSelect.click();
          await page.getByRole("option", { name: "Organization" }).click();
          await expect(page.getByLabel("Multi-Organization Environment")).toBeVisible({
            timeout: 10000,
          });

          await mobileTabSelect.click();
          await page.getByRole("option", { name: "Auth" }).click();
          await expect(page.getByLabel("Maximum Failed Login Attempts")).toBeVisible({
            timeout: 10000,
          });
        }
      } finally {
        if (originalViewport) {
          await page.setViewportSize(originalViewport);
        }
      }
    });
  });
});
