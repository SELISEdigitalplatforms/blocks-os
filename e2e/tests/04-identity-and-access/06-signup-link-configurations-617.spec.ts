import { expect } from "@playwright/test";
import { test } from "../../support/test-base";
import {
  archiveConfigurationFlow,
  archiveIfPresentFlow,
  chooseFirstClientFlow,
  clientSideRequiredValidationFlow,
  countConfigurationWrites,
  createConfigurationFlow,
  editDescriptionOnlyFlow,
  EXISTING_USER_WARNING,
  existingUserWarning,
  expectConfigurationRowFlow,
  expectFirstRunEmptyOrList,
  fillStoredSwitchWhileIamOmitsIt,
  maxRedemptionsInput,
  navigateToSignupLinkConfigurationsFlow,
  nextConfigurationWrite,
  openAddConfigurationDialogFlow,
  openEditConfigurationFlow,
  requireExistingUserPasswordSwitch,
  searchConfigurationFlow,
  selectOptionFlow,
  setRequireExistingUserPasswordFlow,
  showArchivedFlow,
} from "../../pages/identity-and-access/signup-link-configurations";

/**
 * Feature E2E for blocks-os#617 — Signup Link Configurations.
 * Requires blocks-iam SPEC21 endpoints on the preview environment.
 */
test.describe("flows", () => {
  test("Signup Link Configurations: validate -> create -> search -> edit -> archive", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const name = `E2E Config ${Date.now()}`;

    await test.step("Navigate to Signup Link Configurations (H1)", async () => {
      await navigateToSignupLinkConfigurationsFlow(page);
      await expectFirstRunEmptyOrList(page);
    });

    await test.step("Open Add Configuration and client-side validate empty form", async () => {
      await openAddConfigurationDialogFlow(page);
      await clientSideRequiredValidationFlow(page);
    });

    await test.step(`Create configuration "${name}" (H3)`, async () => {
      await createConfigurationFlow(page, { name });
    });

    await test.step("Search filters the list (H6)", async () => {
      await searchConfigurationFlow(page, name);
    });

    await test.step("Edit description only (H4)", async () => {
      await editDescriptionOnlyFlow(page, name, "Updated by E2E");
    });

    await test.step("Archive with cancel then confirm (H5, C9)", async () => {
      await archiveConfigurationFlow(page, name);
    });

    await test.step("Show archived restores the row (H7)", async () => {
      await showArchivedFlow(page);
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Archived").first()).toBeVisible();
    });
  });
});

/**
 * Feature E2E for blocks-os#645 — "Existing users must confirm their password" switch and
 * Max redemptions on signup link configurations.
 */
test.describe("flows #645", () => {
  const stamp = Date.now();
  const defaultsName = `E2E 645 defaults ${stamp}`;
  const offName = `E2E 645 off ${stamp}`;
  const maxName = `E2E 645 max ${stamp}`;
  const embeddedName = `E2E 645 embedded ${stamp}`;
  const created: string[] = [];

  // Archive what each test created, with the test's own signed-in page.
  test.afterEach(async ({ page }) => {
    if (!created.length) return;
    const names = created.splice(0);
    await navigateToSignupLinkConfigurationsFlow(page);
    for (const name of names) await archiveIfPresentFlow(page, name);
  });

  test("Create with defaults sends the switch on and null max (H1, H2, H7, H11, H12)", async ({
    page,
  }) => {
    await navigateToSignupLinkConfigurationsFlow(page);
    await openAddConfigurationDialogFlow(page);

    await expect(requireExistingUserPasswordSwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(existingUserWarning(page)).toHaveCount(0);
    await expect(maxRedemptionsInput(page)).toHaveValue("");

    await page.getByPlaceholder("Partner onboarding").fill(defaultsName);
    await chooseFirstClientFlow(page);
    const body = nextConfigurationWrite(page, "POST");
    await page.getByRole("button", { name: "Create" }).click();
    const sent = await body;
    expect(sent.requireExistingUserPassword).toBe(true);
    expect(sent).toHaveProperty("defaultMaxRedemptions", null);
    await expect(page.getByText("Configuration created", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    created.push(defaultsName);

    await expectConfigurationRowFlow(page, defaultsName, {
      maxUses: "Single use",
      existingUserPassword: "Required",
    });
  });

  test("Invalid Max redemptions values block the request (C1, C2, C3)", async ({ page }) => {
    await navigateToSignupLinkConfigurationsFlow(page);
    await openAddConfigurationDialogFlow(page);
    await page.getByPlaceholder("Partner onboarding").fill(`E2E 645 invalid ${stamp}`);
    await chooseFirstClientFlow(page);
    const writes = countConfigurationWrites(page);

    const cases: [string, string][] = [
      ["-1", "Enter 0 or a whole number"],
      ["1.5", "Enter 0 or a whole number"],
      ["abc", "Enter 0 or a whole number"],
      ["1e3", "Enter 0 or a whole number"],
      ["3000000000", "Enter a smaller number"],
    ];
    for (const [value, message] of cases) {
      await maxRedemptionsInput(page).fill(value);
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      await expect(maxRedemptionsInput(page)).toHaveAttribute("aria-invalid", "true");
    }
    await page.waitForTimeout(1_000);
    expect(writes.count()).toBe(0);
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("Server field error is shown under Max redemptions and focused (C4)", async ({ page }) => {
    await page.route(/\/signup-links\/configurations\/?$/, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ errors: { DefaultMaxRedemptions: "Bad" } }),
      });
    });
    await navigateToSignupLinkConfigurationsFlow(page);
    await openAddConfigurationDialogFlow(page);
    await page.getByPlaceholder("Partner onboarding").fill(`E2E 645 stub ${stamp}`);
    await chooseFirstClientFlow(page);
    await maxRedemptionsInput(page).fill("4");
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText("Bad", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(maxRedemptionsInput(page)).toBeFocused();
    // C7: the dialog stays open with the entered values.
    await expect(page.getByRole("heading", { name: "Add Configuration" })).toBeVisible();
    await expect(maxRedemptionsInput(page)).toHaveValue("4");
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("Switch keeps its value across mode changes and is sent in embedded mode (C6)", async ({
    page,
  }) => {
    await navigateToSignupLinkConfigurationsFlow(page);
    await openAddConfigurationDialogFlow(page);
    await page.getByPlaceholder("Partner onboarding").fill(embeddedName);
    await setRequireExistingUserPasswordFlow(page, false);

    await selectOptionFlow(page, "mode-select", "Embedded");
    await expect(requireExistingUserPasswordSwitch(page)).toHaveAttribute("aria-checked", "false");
    await selectOptionFlow(page, "credential-mode-select", "Password required");
    await expect(requireExistingUserPasswordSwitch(page)).toHaveAttribute("aria-checked", "false");
    await selectOptionFlow(page, "credential-mode-select", "Passwordless");
    await expect(requireExistingUserPasswordSwitch(page)).toHaveAttribute("aria-checked", "false");

    const body = nextConfigurationWrite(page, "POST");
    await page.getByRole("button", { name: "Create" }).click();
    const sent = await body;
    expect(sent.mode).toBe("Embedded");
    expect(sent.requireExistingUserPassword).toBe(false);
    expect(sent).toHaveProperty("defaultMaxRedemptions", null);
    await expect(page.getByText("Configuration created", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    created.push(embeddedName);
  });

  test("Keyboard toggles the switch and the warning is announced; screenshots (H3, H4, H13, C9)", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateToSignupLinkConfigurationsFlow(page);
    await openAddConfigurationDialogFlow(page);
    await testInfo.attach("create-toggle-on-1440", {
      body: await page.screenshot(),
      contentType: "image/png",
    });

    // Keyboard only: tab from the field before the switch until the switch has focus.
    await page.getByPlaceholder("/welcome (optional)").focus();
    const control = requireExistingUserPasswordSwitch(page);
    for (let i = 0; i < 8; i += 1) {
      if (await control.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(control).toBeFocused();
    await page.keyboard.press("Space");
    await expect(control).toHaveAttribute("aria-checked", "false");
    await expect(existingUserWarning(page)).toBeVisible();
    await expect(existingUserWarning(page)).toContainText(
      "Existing users won't be asked for a password",
    );
    await expect(existingUserWarning(page)).toContainText(EXISTING_USER_WARNING);
    await control.scrollIntoViewIfNeeded();
    await testInfo.attach("create-toggle-off-1440", {
      body: await page.screenshot(),
      contentType: "image/png",
    });

    await page.keyboard.press("Space");
    await expect(control).toHaveAttribute("aria-checked", "true");
    await expect(existingUserWarning(page)).toHaveCount(0);

    await maxRedemptionsInput(page).fill("-1");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Enter 0 or a whole number", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    await testInfo.attach("create-invalid-max-375", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await testInfo.attach("create-invalid-max-375-dark", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("Max redemptions are stored, edited and listed (H8, H9, H10, H11, C5)", async ({ page }) => {
    test.setTimeout(180_000);
    await navigateToSignupLinkConfigurationsFlow(page);

    await test.step("Create with max 0", async () => {
      await openAddConfigurationDialogFlow(page);
      await page.getByPlaceholder("Partner onboarding").fill(maxName);
      await chooseFirstClientFlow(page);
      await maxRedemptionsInput(page).fill("0");
      const body = nextConfigurationWrite(page, "POST");
      await page.getByRole("button", { name: "Create" }).click();
      const sent = await body;
      expect(sent.defaultMaxRedemptions).toBe(0);
      expect(sent.requireExistingUserPassword).toBe(true);
      await expect(page.getByText("Configuration created", { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      created.push(maxName);
      await expectConfigurationRowFlow(page, maxName, {
        maxUses: "Unlimited",
        existingUserPassword: "Required",
      });
    });

    await test.step("Edit loads 0 and a description-only change sends only dirty fields plus the switch", async () => {
      await openEditConfigurationFlow(page, maxName);
      await expect(maxRedemptionsInput(page)).toHaveValue("0");
      await page.getByPlaceholder("Optional description").fill("Edited by E2E 645");
      const body = nextConfigurationWrite(page, "PATCH");
      await page.getByRole("button", { name: "Update" }).click();
      const sent = await body;
      expect(Object.keys(sent).sort()).toEqual(
        ["description", "mode", "requireExistingUserPassword"].sort(),
      );
      expect(sent.requireExistingUserPassword).toBe(true);
      await expect(page.getByText("Configuration updated", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    });

    await test.step("Set max 5, then clear it and save as single use", async () => {
      await openEditConfigurationFlow(page, maxName);
      await maxRedemptionsInput(page).fill("5");
      const five = nextConfigurationWrite(page, "PATCH");
      await page.getByRole("button", { name: "Update" }).click();
      expect((await five).defaultMaxRedemptions).toBe(5);
      await expect(page.getByRole("heading", { name: "Update Configuration" })).toBeHidden({
        timeout: 15_000,
      });
      await expectConfigurationRowFlow(page, maxName, {
        maxUses: "5 uses",
        existingUserPassword: "Required",
      });

      await openEditConfigurationFlow(page, maxName);
      await expect(maxRedemptionsInput(page)).toHaveValue("5");
      await maxRedemptionsInput(page).fill("");
      const cleared = nextConfigurationWrite(page, "PATCH");
      await page.getByRole("button", { name: "Update" }).click();
      expect((await cleared).defaultMaxRedemptions).toBe(1);
      await expect(page.getByRole("heading", { name: "Update Configuration" })).toBeHidden({
        timeout: 15_000,
      });
      await expectConfigurationRowFlow(page, maxName, {
        maxUses: "Single use",
        existingUserPassword: "Required",
      });
    });
  });

  /**
   * Reads the stored switch value back from IAM, so the stored value needs the
   * blocks-iam requireExistingUserPassword field (SPEC27, blocks-iam#593) on
   * dev-iam. Until that is deployed the value is filled into IAM's read
   * responses for this one configuration, and the test records that it did.
   */
  test("Switch off is stored, listed and loaded on edit (H3, H4, H5, H6, H12)", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const storedSwitch = await fillStoredSwitchWhileIamOmitsIt(page, offName, false);
    await navigateToSignupLinkConfigurationsFlow(page);

    await test.step("Create with the switch off", async () => {
      await openAddConfigurationDialogFlow(page);
      await page.getByPlaceholder("Partner onboarding").fill(offName);
      await chooseFirstClientFlow(page);
      await setRequireExistingUserPasswordFlow(page, false);
      await expect(existingUserWarning(page)).toBeVisible();
      await setRequireExistingUserPasswordFlow(page, true);
      await expect(existingUserWarning(page)).toHaveCount(0);
      await setRequireExistingUserPasswordFlow(page, false);
      const body = nextConfigurationWrite(page, "POST");
      await page.getByRole("button", { name: "Create" }).click();
      const sent = await body;
      expect(sent.requireExistingUserPassword).toBe(false);
      await expect(page.getByText("Configuration created", { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      created.push(offName);
      await expectConfigurationRowFlow(page, offName, {
        maxUses: "Single use",
        existingUserPassword: "Not required",
      });
    });

    await test.step("Edit loads the switch off and sends it with a description-only change", async () => {
      await openEditConfigurationFlow(page, offName);
      await expect(requireExistingUserPasswordSwitch(page)).toHaveAttribute(
        "aria-checked",
        "false",
      );
      await expect(existingUserWarning(page)).toBeVisible();
      await page.getByPlaceholder("Optional description").fill("Edited by E2E 645");
      const body = nextConfigurationWrite(page, "PATCH");
      await page.getByRole("button", { name: "Update" }).click();
      const sent = await body;
      expect(Object.keys(sent).sort()).toEqual(
        ["description", "mode", "requireExistingUserPassword"].sort(),
      );
      expect(sent.requireExistingUserPassword).toBe(false);
      await expect(page.getByText("Configuration updated", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    });

    testInfo.annotations.push({
      type: "iam-dependency",
      description:
        storedSwitch.filled() > 0
          ? `dev-iam omitted requireExistingUserPassword; filled ${storedSwitch.filled()} read response(s) until blocks-iam#593 is deployed`
          : "dev-iam returned the stored requireExistingUserPassword value",
    });
  });
});
