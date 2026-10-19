import { expect, type Page, type TestInfo } from "@playwright/test";
import { test } from "../../support/test-base";
import {
  OIDC_APP_TYPE_HELPER,
  OIDC_MOBILE_URI_INVALID,
  OIDC_MOBILE_URI_NEEDS_MOBILE_TYPE,
  OIDC_REDIRECT_PLACEHOLDER,
  OIDC_WEB_HTTPS_INVALID,
  type OidcClientsApi,
  applicationTypeRadio,
  closeOidcDialogFlow,
  countOidcRequests,
  deleteOidcClientFlow,
  expectApplicationTypeFlow,
  expectMobileLockedStateFlow,
  navigateToOidcFlow,
  nextOidcSave,
  oidcClientRow,
  oidcClientsApiFlow,
  oidcRedirectUriInputs,
  openEditOidcClientFlow,
  openNewOidcClientDialogFlow,
  selectApplicationTypeFlow,
  setConsoleThemeFlow,
  stubOidcSave400,
} from "../../pages/secrets-and-configs/oidc";

/**
 * #680 — OIDC client "Application type" (Web application / Mobile app).
 * Spec: section 10 steps 1–12, section 4 (visual), section 5 (one GET on edit, one POST per save).
 * Every client created here is removed in `finally` through DELETE oidc-clients/{id}.
 */

const MOBILE_URI = "com.blocks.e2e.app://login/callback";
const WEB_URI = "https://portal.example.com/callback";

const nameInput = (page: Page) => page.getByPlaceholder("Enter client name");
const addButton = (page: Page) => page.getByRole("button", { name: "Add", exact: true });
const updateButton = (page: Page) => page.getByRole("button", { name: "Update", exact: true });
const createdToast = (page: Page) =>
  page.getByText("OIDC Client created successfully", { exact: true });
const updatedToast = (page: Page) =>
  page.getByText("OIDC Client updated successfully", { exact: true });
const uniqueName = (prefix: string) => `${prefix}-${Date.now()}`;

/** Fills the single redirect entry and waits for the onChange validation to settle. */
async function fillRedirect(page: Page, value: string, index = 0) {
  await oidcRedirectUriInputs(page).nth(index).fill(value);
  await oidcRedirectUriInputs(page).nth(index).blur();
}

async function cleanup(api: OidcClientsApi | undefined, names: string[]) {
  if (!api) return;
  for (const name of names) await api.removeByName(name);
}

test.describe("OIDC client application type (#680)", () => {
  test("H1, H2, H3, H6, H11, H12: create a Mobile app client, then reopen it preselected", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const clientName = uniqueName("e2e-mobile");
    let api: OidcClientsApi | undefined;
    try {
      api = await oidcClientsApiFlow(page);

      await test.step("H1: Create opens with Web application selected and the Web helper line", async () => {
        await openNewOidcClientDialogFlow(page);
        await expect(page.getByText("Application type", { exact: true })).toBeVisible();
        await expectApplicationTypeFlow(page, "web");
        await expect(page.getByPlaceholder(OIDC_REDIRECT_PLACEHOLDER.web)).toBeVisible();
        await expect(page.locator("#registerAsIdentityProvider")).toBeVisible();
      });

      await test.step("H2: Mobile app locks PKCE, hides Identity Provider, shows the app placeholder + Mobile helper", async () => {
        await selectApplicationTypeFlow(page, "mobile");
        await expectApplicationTypeFlow(page, "mobile");
        await expectMobileLockedStateFlow(page);
      });

      await test.step("H3: save sends clientType public, useTokensCookie false, PKCE on, IdP off; success toast", async () => {
        await nameInput(page).fill(clientName);
        await fillRedirect(page, MOBILE_URI);
        await expect(addButton(page)).toBeEnabled({ timeout: 10_000 });
        const save = nextOidcSave(page);
        await addButton(page).click();
        const body = await save;
        expect(body.clientType).toBe("public");
        expect(body.useTokensCookie).toBe(false);
        expect(body.requirePkce).toBe(true);
        expect(body.registerAsIdentityProvider).toBe(false);
        expect(body.redirectUris).toEqual([MOBILE_URI]);
        await expect(createdToast(page)).toBeVisible({ timeout: 15_000 });
      });

      await test.step("H6, H12, H11: reopen → Mobile preselected with the same URI; exactly one GET oidc-clients/{id}", async () => {
        const counter = countOidcRequests(page);
        await openEditOidcClientFlow(page, clientName);
        await expectApplicationTypeFlow(page, "mobile");
        await expect(oidcRedirectUriInputs(page)).toHaveCount(1);
        await expect(oidcRedirectUriInputs(page).first()).toHaveValue(MOBILE_URI);
        await expectMobileLockedStateFlow(page);
        await page.waitForTimeout(1_500);
        expect(counter.getsById(), "edit open makes exactly one GET oidc-clients/{id}").toBe(1);
        counter.stop();
        await closeOidcDialogFlow(page);

        const id = await api!.idByName(clientName);
        expect(id).toBeTruthy();
        const stored = await api!.get(id!);
        expect(String(stored.clientType).toLowerCase()).toBe("public");
        expect(stored.useTokensCookie).toBe(false);
      });

      await test.step("Cleanup: delete e2e-mobile through the UI delete flow", async () => {
        await deleteOidcClientFlow(page, oidcClientRow(page, clientName), clientName);
      });
    } finally {
      await cleanup(api, [clientName]);
    }
  });

  test("H7, H8, C6: editing fixture P (public + cookie) as Web keeps clientType public and useTokensCookie true", async ({
    page,
  }) => {
    const nameP = uniqueName("e2e-fixture-p");
    const renamed = `${nameP}-renamed`;
    let api: OidcClientsApi | undefined;
    try {
      api = await oidcClientsApiFlow(page);
      const id = await api.create({
        clientDisplayName: nameP,
        redirectUris: ["https://p.example.com/cb"],
        clientType: "public",
        useTokensCookie: true,
      });
      await navigateToOidcFlow(page);

      await test.step("H7: P opens with Web application preselected", async () => {
        await openEditOidcClientFlow(page, nameP);
        await expectApplicationTypeFlow(page, "web");
      });

      await test.step("H8: change only the name → POST resends clientType public, useTokensCookie true", async () => {
        await nameInput(page).fill(renamed);
        await expect(updateButton(page)).toBeEnabled({ timeout: 10_000 });
        const save = nextOidcSave(page);
        await updateButton(page).click();
        const body = await save;
        expect(body.clientType).toBe("public");
        expect(body.useTokensCookie).toBe(true);
        await expect(updatedToast(page)).toBeVisible({ timeout: 15_000 });
      });

      await test.step("C6: GET confirms P is still public with cookie delivery", async () => {
        const stored = await api!.get(id);
        expect(stored.clientDisplayName).toBe(renamed);
        expect(String(stored.clientType).toLowerCase()).toBe("public");
        expect(stored.useTokensCookie).toBe(true);
      });
    } finally {
      await cleanup(api, [nameP, renamed]);
    }
  });

  test("H5: a new Web application client sends clientType confidential and useTokensCookie true", async ({
    page,
  }) => {
    const clientName = uniqueName("e2e-web");
    let api: OidcClientsApi | undefined;
    try {
      api = await oidcClientsApiFlow(page);
      await openNewOidcClientDialogFlow(page);
      await nameInput(page).fill(clientName);
      await fillRedirect(page, WEB_URI);
      await expect(addButton(page)).toBeEnabled({ timeout: 10_000 });
      const save = nextOidcSave(page);
      await addButton(page).click();
      const body = await save;
      expect(body.clientType).toBe("confidential");
      expect(body.useTokensCookie).toBe(true);
      expect(body.redirectUris).toEqual([WEB_URI]);
      await expect(createdToast(page)).toBeVisible({ timeout: 15_000 });
    } finally {
      await cleanup(api, [clientName]);
    }
  });

  test("C1, C2, C3, C4, C5, H4: redirect URI validation per application type, with no POST for invalid entries", async ({
    page,
  }) => {
    await navigateToOidcFlow(page);
    await openNewOidcClientDialogFlow(page);
    await nameInput(page).fill(uniqueName("e2e-negative"));
    const counter = countOidcRequests(page);

    await test.step("C1: Web + app-scheme URI → 'needs the Mobile app application type', submit disabled", async () => {
      await fillRedirect(page, "com.blocks.e2e.app://cb");
      await expect(
        page.getByText(OIDC_MOBILE_URI_NEEDS_MOBILE_TYPE, { exact: true }),
      ).toBeVisible();
      await expect(addButton(page)).toBeDisabled();
    });

    await selectApplicationTypeFlow(page, "mobile");
    for (const [criterion, value] of [
      ["C2", "myapp://cb"],
      ["C3", "javascript:alert(1)"],
      ["C4", "com.blocks.e2e.app://cb#x"],
    ] as const) {
      await test.step(`${criterion}: Mobile + ${value} → Mobile invalid message, no POST`, async () => {
        await fillRedirect(page, value);
        await expect(page.getByText(OIDC_MOBILE_URI_INVALID, { exact: true })).toBeVisible();
        await expect(addButton(page)).toBeDisabled();
        // Implicit submit from the field must not reach the network either.
        await oidcRedirectUriInputs(page).first().press("Enter");
        await page.waitForTimeout(1_000);
        expect(counter.saves(), `${criterion} sends no POST oidc-clients`).toBe(0);
      });
    }

    await test.step("H4: Mobile + https public-domain URI is accepted", async () => {
      await fillRedirect(page, WEB_URI);
      await expect(page.getByText(OIDC_MOBILE_URI_INVALID, { exact: true })).toHaveCount(0);
      await expect(addButton(page)).toBeEnabled({ timeout: 10_000 });
    });

    await test.step("C5: Web + http non-localhost URI → existing HTTPS message", async () => {
      await selectApplicationTypeFlow(page, "web");
      await fillRedirect(page, "http://portal.example.com/cb");
      await expect(page.getByText(OIDC_WEB_HTTPS_INVALID, { exact: true })).toBeVisible();
      await expect(addButton(page)).toBeDisabled();
      expect(counter.saves()).toBe(0);
    });

    counter.stop();
    await closeOidcDialogFlow(page);
  });

  test("C9, C10, H9: switching a Mobile client to Web flags app-scheme URIs, unlocks PKCE/IdP, then saves confidential", async ({
    page,
  }) => {
    const clientName = uniqueName("e2e-mobile-switch");
    let api: OidcClientsApi | undefined;
    try {
      api = await oidcClientsApiFlow(page);
      const id = await api.create({
        clientDisplayName: clientName,
        redirectUris: [MOBILE_URI],
        clientType: "public",
        useTokensCookie: false,
      });
      await navigateToOidcFlow(page);
      await openEditOidcClientFlow(page, clientName);
      await expectApplicationTypeFlow(page, "mobile");

      await test.step("C9: switch to Web while the app-scheme URI is present → C1 message at once, submit disabled", async () => {
        await selectApplicationTypeFlow(page, "web");
        await expect(
          page.getByText(OIDC_MOBILE_URI_NEEDS_MOBILE_TYPE, { exact: true }),
        ).toBeVisible();
        await expect(updateButton(page)).toBeDisabled();
      });

      await test.step("C10: PKCE is enabled again with its value; Identity Provider row is back, unchecked", async () => {
        const pkce = page.locator("#requirePkce");
        await expect(pkce).toBeEnabled();
        await expect(pkce).toBeChecked();
        await expect(page.getByText("Required for mobile apps", { exact: true })).toHaveCount(0);
        const idp = page.locator("#registerAsIdentityProvider");
        await expect(idp).toBeVisible();
        await expect(idp).not.toBeChecked();
      });

      await test.step("H9: remove the app-scheme URI, add an https one, save → confidential + cookie", async () => {
        await page.getByRole("button", { name: "Add Redirect URI" }).click();
        await expect(oidcRedirectUriInputs(page)).toHaveCount(2);
        await fillRedirect(page, WEB_URI, 1);
        await oidcRedirectUriInputs(page)
          .first()
          .locator("xpath=../..")
          .getByRole("button")
          .click();
        await expect(oidcRedirectUriInputs(page)).toHaveCount(1);
        await expect(oidcRedirectUriInputs(page).first()).toHaveValue(WEB_URI);
        await expect(updateButton(page)).toBeEnabled({ timeout: 10_000 });
        const save = nextOidcSave(page);
        await updateButton(page).click();
        const body = await save;
        expect(body.clientType).toBe("confidential");
        expect(body.useTokensCookie).toBe(true);
        expect(body.redirectUris).toEqual([WEB_URI]);
        await expect(updatedToast(page)).toBeVisible({ timeout: 15_000 });
        const stored = await api!.get(id);
        expect(String(stored.clientType).toLowerCase()).toBe("confidential");
        expect(stored.useTokensCookie).toBe(true);
      });
    } finally {
      await cleanup(api, [clientName]);
    }
  });

  test("H10, C11: Device Flow while Mobile is selected hides the type and sends the device payload; unticking restores Mobile", async ({
    page,
  }) => {
    const deviceName = uniqueName("e2e-device");
    const restoredName = uniqueName("e2e-mobile-restored");
    let api: OidcClientsApi | undefined;
    try {
      api = await oidcClientsApiFlow(page);

      await test.step("H10, C11: tick Device Flow with Mobile selected → type + redirect hidden; device payload", async () => {
        await openNewOidcClientDialogFlow(page);
        await nameInput(page).fill(deviceName);
        await selectApplicationTypeFlow(page, "mobile");
        await page.locator("#isDeviceFlowClient").click();
        await expect(applicationTypeRadio(page, "mobile")).toHaveCount(0);
        await expect(applicationTypeRadio(page, "web")).toHaveCount(0);
        await expect(oidcRedirectUriInputs(page)).toHaveCount(0);
        await expect(addButton(page)).toBeEnabled({ timeout: 10_000 });
        const save = nextOidcSave(page);
        await addButton(page).click();
        const body = await save;
        expect(body.isDeviceFlowClient).toBe(true);
        expect(body.redirectUris).toEqual([]);
        expect(body.requirePkce).toBe(false);
        expect(body.registerAsIdentityProvider).toBe(false);
        // Create: stored defaults (clientType omitted / null, useTokensCookie true) — spec 6.4.
        expect(body.clientType ?? null).toBeNull();
        expect(body.useTokensCookie ?? true).toBe(true);
        await expect(createdToast(page)).toBeVisible({ timeout: 15_000 });
      });

      await test.step("C11: on another new client, untick Device Flow → Mobile restored and saved as public", async () => {
        await openNewOidcClientDialogFlow(page);
        await nameInput(page).fill(restoredName);
        await selectApplicationTypeFlow(page, "mobile");
        const deviceFlow = page.locator("#isDeviceFlowClient");
        await deviceFlow.click();
        await expect(applicationTypeRadio(page, "mobile")).toHaveCount(0);
        await deviceFlow.click();
        await expectApplicationTypeFlow(page, "mobile");
        await expectMobileLockedStateFlow(page);
        await fillRedirect(page, MOBILE_URI);
        await expect(addButton(page)).toBeEnabled({ timeout: 10_000 });
        const save = nextOidcSave(page);
        await addButton(page).click();
        const body = await save;
        expect(body.isDeviceFlowClient).toBe(false);
        expect(body.clientType).toBe("public");
        expect(body.useTokensCookie).toBe(false);
        await expect(createdToast(page)).toBeVisible({ timeout: 15_000 });
      });
    } finally {
      await cleanup(api, [deviceName, restoredName]);
    }
  });

  test("C8: an IAM 400 on save shows the error toast and keeps the dialog open with the input kept", async ({
    page,
  }) => {
    const clientName = uniqueName("e2e-mobile-400");
    let api: OidcClientsApi | undefined;
    let stub: { unroute: () => Promise<void> } | undefined;
    try {
      api = await oidcClientsApiFlow(page);
      stub = await stubOidcSave400(page);
      await openNewOidcClientDialogFlow(page);
      await nameInput(page).fill(clientName);
      await selectApplicationTypeFlow(page, "mobile");
      await fillRedirect(page, MOBILE_URI);
      await expect(addButton(page)).toBeEnabled({ timeout: 10_000 });
      const save = nextOidcSave(page);
      await addButton(page).click();
      await save;
      await expect(page.getByText("Failed", { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(createdToast(page)).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "New OIDC Client" })).toBeVisible();
      await expect(nameInput(page)).toHaveValue(clientName);
      await expect(oidcRedirectUriInputs(page).first()).toHaveValue(MOBILE_URI);
      await expectApplicationTypeFlow(page, "mobile");
      await closeOidcDialogFlow(page);
    } finally {
      await stub?.unroute();
      await cleanup(api, [clientName]);
    }
  });

  test("C12: double-clicking save sends a single POST oidc-clients", async ({ page }) => {
    const clientName = uniqueName("e2e-dblclick");
    let api: OidcClientsApi | undefined;
    try {
      api = await oidcClientsApiFlow(page);
      await openNewOidcClientDialogFlow(page);
      await nameInput(page).fill(clientName);
      await fillRedirect(page, WEB_URI);
      await expect(addButton(page)).toBeEnabled({ timeout: 10_000 });
      const counter = countOidcRequests(page);
      await addButton(page).dblclick();
      await expect(createdToast(page)).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(2_000);
      expect(counter.saves(), "one POST oidc-clients per save").toBe(1);
      counter.stop();
      expect((await api.list()).filter((c) => c.clientDisplayName === clientName)).toHaveLength(1);
    } finally {
      await cleanup(api, [clientName]);
    }
  });

  test("Q1 (approved A): the list status toggle on a Mobile client keeps clientType public and useTokensCookie false", async ({
    page,
  }) => {
    const clientName = uniqueName("e2e-mobile-toggle");
    let api: OidcClientsApi | undefined;
    try {
      api = await oidcClientsApiFlow(page);
      const id = await api.create({
        clientDisplayName: clientName,
        redirectUris: [MOBILE_URI],
        clientType: "public",
        useTokensCookie: false,
      });
      await navigateToOidcFlow(page);
      const row = oidcClientRow(page, clientName);
      await expect(row).toBeVisible({ timeout: 15_000 });

      await row.getByRole("button", { name: "Disable OIDC client" }).click();
      const confirm = page.getByRole("dialog", { name: "Disable OIDC client" });
      await expect(confirm).toBeVisible();
      const save = nextOidcSave(page);
      await confirm.getByRole("button", { name: "Disable", exact: true }).click();
      const body = await save;
      expect(body.isActive).toBe(false);
      expect(body.clientType).toBe("public");
      expect(body.useTokensCookie).toBe(false);
      await expect(
        page.getByText("OIDC client disabled successfully", { exact: true }),
      ).toBeVisible({
        timeout: 15_000,
      });

      const stored = await api.get(id);
      expect(stored.isActive).toBe(false);
      expect(String(stored.clientType).toLowerCase()).toBe("public");
      expect(stored.useTokensCookie).toBe(false);
    } finally {
      await cleanup(api, [clientName]);
    }
  });

  test("Section 4 visual + keyboard: screenshots at 390×844, 768×1024, 1440×900 in light and dark; Tab + arrows drive the type", async ({
    page,
  }, testInfo) => {
    test.setTimeout(420_000);
    const editName = uniqueName("e2e-mobile-visual");
    const viewports = [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ];
    let api: OidcClientsApi | undefined;

    const shot = async (info: TestInfo, name: string) => {
      const file = info.outputPath(`${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      await info.attach(name, { path: file, contentType: "image/png" });
    };

    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      api = await oidcClientsApiFlow(page);
      await api.create({
        clientDisplayName: editName,
        redirectUris: [MOBILE_URI],
        clientType: "public",
        useTokensCookie: false,
      });

      await test.step("Keyboard: Tab reaches the Application type group and arrow keys switch the type", async () => {
        await navigateToOidcFlow(page);
        await openNewOidcClientDialogFlow(page);
        await nameInput(page).focus();
        let reached = false;
        for (let i = 0; i < 6 && !reached; i += 1) {
          await page.keyboard.press("Tab");
          reached = await page.evaluate(
            () => document.activeElement?.id?.startsWith("applicationType-") ?? false,
          );
        }
        expect(reached, "Tab from Client Name reaches the Application type radio group").toBe(true);
        await expect(applicationTypeRadio(page, "web")).toBeFocused();
        await page.keyboard.press("ArrowDown");
        await expect(applicationTypeRadio(page, "mobile")).toHaveAttribute("aria-checked", "true");
        await expect(applicationTypeRadio(page, "mobile")).toBeFocused();
        await expect(page.getByText(OIDC_APP_TYPE_HELPER.mobile, { exact: true })).toBeVisible();
        await page.keyboard.press("ArrowUp");
        await expect(applicationTypeRadio(page, "web")).toHaveAttribute("aria-checked", "true");
        await closeOidcDialogFlow(page);
      });

      for (const theme of ["light", "dark"] as const) {
        await test.step(`Theme ${theme}`, async () => {
          await page.setViewportSize({ width: 1440, height: 900 });
          await navigateToOidcFlow(page);
          await setConsoleThemeFlow(page, theme);

          for (const vp of viewports) {
            const tag = `${theme}-${vp.width}x${vp.height}`;
            await test.step(`Screenshots ${tag}`, async () => {
              await page.setViewportSize(vp);
              await navigateToOidcFlow(page);

              await openNewOidcClientDialogFlow(page);
              await expectApplicationTypeFlow(page, "web");
              await shot(testInfo, `680-create-web-${tag}`);

              await selectApplicationTypeFlow(page, "mobile");
              await expectMobileLockedStateFlow(page);
              await shot(testInfo, `680-create-mobile-${tag}`);

              await fillRedirect(page, "myapp://cb");
              await expect(page.getByText(OIDC_MOBILE_URI_INVALID, { exact: true })).toBeVisible();
              await shot(testInfo, `680-mobile-invalid-${tag}`);
              await closeOidcDialogFlow(page);

              await openEditOidcClientFlow(page, editName);
              await expectApplicationTypeFlow(page, "mobile");
              await expect(oidcRedirectUriInputs(page).first()).toHaveValue(MOBILE_URI);
              await shot(testInfo, `680-edit-mobile-${tag}`);
              await closeOidcDialogFlow(page);
            });
          }
        });
      }
    } finally {
      await page.setViewportSize({ width: 1440, height: 900 });
      await setConsoleThemeFlow(page, "system").catch(() => {});
      await cleanup(api, [editName]);
    }
  });
});
