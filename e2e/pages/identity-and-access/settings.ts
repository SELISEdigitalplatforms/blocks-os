import { expect, type Page } from "@playwright/test";
import { openIam } from "../../support/os-helpers";

export async function navigateToSettingsFlow(page: Page) {
  await openIam(page, "settings", "Auth Configuration");
  await expect(page.getByRole("heading", { name: "Auth Configuration" })).toBeVisible({
    timeout: 30_000,
  });
  // The desktop TabsList is `hidden md:flex` (display:none) on the mobile
  // viewport, which drops its `tab` roles from the accessibility tree
  // entirely — only assert tab visibility on wider viewports.
  const viewport = page.viewportSize();
  if (!viewport || viewport.width >= 768) {
    await expect(page.getByRole("tab", { name: "Auth" })).toBeVisible();
  }
}

export async function switchSettingsTabFlow(page: Page, tabName: string) {
  const tab = page.getByRole("tab", { name: tabName });
  await expect(tab).toBeVisible({ timeout: 8_000 });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  return tab;
}

export async function lockoutValidationFlow(page: Page) {
  const lockoutInput = page.getByLabel("Maximum Failed Login Attempts");
  await expect(lockoutInput).toBeVisible({ timeout: 8_000 });
  await lockoutInput.fill("0");
  // The form's zod resolver runs on submit only — no onBlur/onChange mode is
  // set — so clicking Save is what surfaces the validation message.
  const saveButton = page.getByRole("button", { name: "Save" });
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();
  // Strict: zero MUST surface the validation error.
  await expect(page.getByText("Value must be greater than zero.")).toBeVisible();
}

export async function resetDiscardsEditFlow(page: Page) {
  // The Auth tab's "Access Token Validity" label is rendered as plain
  // sibling text rather than as a programmatic label for its spinbutton,
  // so getByLabel can't see it — target it positionally instead. It's the
  // first spinbutton under the "Token Configurations" heading.
  const accessTokenInput = page.getByRole("spinbutton").first();
  await expect(accessTokenInput).toBeVisible({ timeout: 5_000 });
  const originalValue = await accessTokenInput.inputValue();
  await accessTokenInput.fill("123");

  const resetButton = page.getByRole("button", { name: "Reset" });
  await expect(resetButton).toBeEnabled({ timeout: 10_000 });
  await resetButton.click();

  await expect(accessTokenInput).toHaveValue(originalValue, { timeout: 10_000 });
  await expect(resetButton).toBeDisabled({ timeout: 10_000 });
}

export async function saveValidAuthSettingFlow(page: Page) {
  const lockoutInput = page.getByLabel("Maximum Failed Login Attempts");
  await expect(lockoutInput).toBeVisible({ timeout: 5_000 });
  await lockoutInput.fill("7");

  const saveButton = page.getByRole("button", { name: "Save" });
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();

  // Strict: a successful save MUST surface the confirmation toast.
  // The toast text also gets echoed inside an aria-live status region, so
  // use exact:true to disambiguate from the (slightly different) status
  // span — otherwise strict mode picks both and the assertion fails.
  await expect(
    page.getByText("Authentication settings updated successfully", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

export async function certificateActionsPresentFlow(page: Page) {
  const copyButton = page.getByRole("button", { name: "Copy certificate URL" });
  await expect(copyButton).toBeVisible({ timeout: 5_000 });
  await copyButton.click();
  await expect(page.getByRole("button", { name: "Download certificate" })).toBeVisible();
}

export async function toggleOidcHidesPathsFlow(page: Page) {
  const oidcSwitch = page.getByLabel("OpenID Connect (OIDC)");
  await expect(oidcSwitch).toBeVisible({ timeout: 8_000 });
  const activationPathInput = page.getByLabel("Account Activation Path");
  // Strict: the activation path input MUST be visible when OIDC is on.
  await expect(activationPathInput).toBeVisible({ timeout: 5_000 });

  await oidcSwitch.click();
  // Strict: toggling OIDC off MUST hide the activation path input.
  await expect(activationPathInput).toBeHidden({ timeout: 5_000 });

  const resetButton = page.getByRole("button", { name: "Reset" });
  // Strict: the Reset button MUST become enabled once a setting has changed.
  await expect(resetButton).toBeEnabled({ timeout: 10_000 });
  await resetButton.click();
  // Strict: after reset, the activation path input MUST reappear.
  await expect(activationPathInput).toBeVisible({ timeout: 10_000 });
}

export async function toggleLogoutAndEditRegexFlow(page: Page) {
  const logoutSwitch = page.getByLabel("Logout on Password Change");
  const regexInput = page.getByLabel("Password Strength Regex");
  await expect(logoutSwitch).toBeVisible({ timeout: 8_000 });
  await logoutSwitch.click();
  if (await regexInput.isVisible({ timeout: 3_000 })) {
    await regexInput.fill("^.{8,}$");
  }

  const saveButton = page.getByRole("button", { name: "Save" });
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();

  // Strict: a successful save MUST surface the confirmation toast.
  await expect(page.getByText("IAM configuration updated successfully", { exact: true })).toBeVisible(
    { timeout: 15_000 },
  );
}

export async function enableSignupAndAssignRolesFlow(page: Page) {
  const signUpSwitch = page.getByLabel("Sign Up Enabled");
  await expect(signUpSwitch).toBeVisible({ timeout: 8_000 });
  const wasChecked = await signUpSwitch.isChecked();
  if (!wasChecked) {
    await signUpSwitch.click();
  }

  const manageRolesButton = page.getByRole("button", { name: "Manage Roles" });
  if (await manageRolesButton.isVisible({ timeout: 5_000 })) {
    await manageRolesButton.click();
    await expect(page.getByRole("heading", { name: "Assign roles" })).toBeVisible();
    const firstRoleCheckbox = page.getByRole("checkbox").first();
    if (await firstRoleCheckbox.isVisible({ timeout: 5_000 })) {
      await firstRoleCheckbox.click();
    }
    await page.getByRole("button", { name: "Set", exact: true }).click();
  }

  const managePermissionsButton = page.getByRole("button", { name: "Manage Permissions" });
  if (await managePermissionsButton.isVisible({ timeout: 5_000 })) {
    await managePermissionsButton.click();
    // Strict: the assign-permissions dialog MUST open.
    await expect(page.getByRole("heading", { name: "Assign permissions" })).toBeVisible({
      timeout: 8_000,
    });
    const firstPermissionCheckbox = page.getByRole("checkbox").first();
    if (await firstPermissionCheckbox.isVisible({ timeout: 5_000 })) {
      await firstPermissionCheckbox.click();
    }
    await page.getByRole("button", { name: "Set", exact: true }).click();
  }

  const saveButton = page.getByRole("button", { name: "Save" });
  // Strict: the Save button MUST become enabled once the form is dirty.
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();

  // Strict: a successful save MUST surface the confirmation toast.
  await expect(page.getByText("Signup settings updated successfully", { exact: true })).toBeVisible(
    { timeout: 15_000 },
  );
}

export async function cancelMultiOrgConfirmationFlow(page: Page) {
  const multiOrgSwitch = page.getByLabel("Multi-Organization Environment");
  const alreadyEnabled = await multiOrgSwitch.isChecked();
  if (alreadyEnabled) return;
  await expect(multiOrgSwitch).toBeVisible({ timeout: 8_000 });
  await multiOrgSwitch.click();
  await expect(
    page.getByRole("heading", { name: "Enable multi-organization mode?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  // Strict: cancelling the confirmation MUST leave the switch unchecked.
  await expect(multiOrgSwitch).not.toBeChecked({ timeout: 5_000 });
}

export async function confirmMultiOrgFlow(page: Page) {
  const multiOrgSwitch = page.getByLabel("Multi-Organization Environment");
  const alreadyEnabled = await multiOrgSwitch.isChecked();
  if (alreadyEnabled) return;
  await expect(multiOrgSwitch).toBeVisible({ timeout: 8_000 });
  await multiOrgSwitch.click();
  await expect(
    page.getByRole("heading", { name: "Enable multi-organization mode?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enable", exact: true }).click();
  // Strict: confirming the dialog MUST flip the switch to checked.
  await expect(multiOrgSwitch).toBeChecked({ timeout: 10_000 });

  await expect(page.getByText("Organization Creation Workflows")).toBeVisible({
    timeout: 10_000,
  });
  const cloudWorkflowSwitch = page.getByLabel("Allow Creation from OS");
  if (await cloudWorkflowSwitch.isVisible({ timeout: 5_000 })) {
    await cloudWorkflowSwitch.click();
  }

  const saveButton = page.getByRole("button", { name: "Save" });
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();

  // Strict: a successful save MUST surface the confirmation toast.
  await expect(page.getByText("Organization configuration updated successfully", { exact: true })).toBeVisible(
    { timeout: 15_000 },
  );
  // Now saved and permanent for this (disposable, per-test) project — the
  // toggle MUST be disabled since it can no longer be turned off.
  await expect(multiOrgSwitch).toBeDisabled({ timeout: 10_000 });
}

export async function mobileTabsSwitchFlow(page: Page) {
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 800 });
  try {
    await navigateToSettingsFlow(page);

    // The desktop TabsList is `hidden md:flex` (display:none) on this
    // viewport, which drops its `tab` roles from the accessibility tree
    // entirely — so verify the switch via each tab's own content instead
    // of the (unqueryable) tab element's aria-selected.
    const mobileTabSelect = page.getByRole("combobox", { name: "Settings section" });
    await expect(mobileTabSelect).toBeVisible({ timeout: 5_000 });
    await mobileTabSelect.click();
    await page.getByRole("option", { name: "IAM" }).click();
    await expect(page.getByLabel("OpenID Connect (OIDC)")).toBeVisible({ timeout: 10_000 });

    await mobileTabSelect.click();
    await page.getByRole("option", { name: "Signup" }).click();
    await expect(page.getByLabel("Sign Up Enabled")).toBeVisible({ timeout: 10_000 });

    await mobileTabSelect.click();
    await page.getByRole("option", { name: "Organization" }).click();
    await expect(page.getByLabel("Multi-Organization Environment")).toBeVisible({
      timeout: 10_000,
    });

    await mobileTabSelect.click();
    await page.getByRole("option", { name: "Auth" }).click();
    await expect(page.getByLabel("Maximum Failed Login Attempts")).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    if (originalViewport) {
      await page.setViewportSize(originalViewport);
    }
  }
}
