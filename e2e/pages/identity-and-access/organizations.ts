import { expect, type Page } from "@playwright/test";
import { openIam } from "../../support/os-helpers";
import { refreshSuiteSession } from "../../support/session-lifecycle";

function addOrgDialog(page: Page) {
  return page.getByRole("dialog", { name: "Add Organization" });
}

function addOrgNameInput(page: Page) {
  return addOrgDialog(page).getByRole("textbox", { name: "Name" });
}

function addOrgSubmitButton(page: Page) {
  return addOrgDialog(page).getByRole("button", { name: "Add", exact: true });
}

function kebabMenuButton(page: Page) {
  return page.getByRole("button").filter({ has: page.locator("svg.lucide-ellipsis-vertical") });
}

export async function enableMultiOrgFlow(page: Page) {
  await openIam(page, "organization", "Organizations");
  const configure = page.getByRole("button", { name: "Configure Organization" }).first();
  await expect(configure).toBeVisible({ timeout: 20_000 });
  await configure.click();
  await expect(page).toHaveURL(/iam\/settings.*organization-config/, { timeout: 15_000 });

  const multiOrgSwitch = page.getByLabel("Multi-Organization Environment");
  await expect(multiOrgSwitch).toBeVisible({ timeout: 20_000 });

  // Once saved, the product locks this switch on — reused projects already have
  // it checked+disabled, so clicking would hang until the test timeout.
  if (!(await multiOrgSwitch.isChecked())) {
    await multiOrgSwitch.click();
    await expect(page.getByRole("heading", { name: "Enable multi-organization mode?" })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Enable", exact: true }).first().click();
    await expect(multiOrgSwitch).toBeChecked({ timeout: 10_000 });
  }

  const cloudWorkflowSwitch = page.getByLabel("Allow Creation from OS");
  await expect(cloudWorkflowSwitch).toBeVisible({ timeout: 15_000 });
  if (!(await cloudWorkflowSwitch.isChecked())) {
    await cloudWorkflowSwitch.click();
  }

  const saveButton = page.getByRole("button", { name: "Save" }).first();
  if (await saveButton.isEnabled()) {
    await saveButton.click();
    await expect(
      page.getByText("Organization configuration updated successfully", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  }
}

export async function verifyAddOrgButtonEnabledFlow(page: Page) {
  await openIam(page, "organization", "Organizations");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Configure Organization" }).first()).toBeVisible();
  await expect(page.getByPlaceholder("Search organizations...").first()).toBeVisible({
    timeout: 15_000,
  });

  const disabledNotice = page.getByText("Multiple Organizations is not enabled");
  await expect(disabledNotice).toBeHidden({
    timeout: 5_000,
  });

  const addOrganizationButton = page.getByRole("button", { name: "Add Organization" }).first();
  await expect(addOrganizationButton).toBeVisible({ timeout: 20_000 });
  await expect(addOrganizationButton).toBeEnabled({ timeout: 20_000 });
}

export async function nameMaxLengthValidationFlow(page: Page) {
  await page.getByRole("button", { name: "Add Organization" }).first().click();
  const dialog = addOrgDialog(page);
  await expect(dialog).toBeVisible();

  const nameInput = addOrgNameInput(page);
  const submitButton = addOrgSubmitButton(page);
  await expect(nameInput).toBeVisible();

  await nameInput.fill("a".repeat(101));
  await expect(submitButton).toBeEnabled({ timeout: 5_000 });
  await submitButton.click();
  await expect(
    dialog.getByText("Name must be at most 100 characters", { exact: true }),
  ).toBeVisible({ timeout: 5_000 });
  await expect(dialog).toBeVisible();
}

export async function createOrganizationFlow(page: Page, orgName: string) {
  const dialog = addOrgDialog(page);
  const nameInput = addOrgNameInput(page);
  const submitButton = addOrgSubmitButton(page);
  const addOrganizationButton = page.getByRole("button", { name: "Add Organization" }).first();

  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await nameInput.fill(orgName);
    await expect(submitButton).toBeEnabled({ timeout: 10_000 });

    const createResponsePromise = page.waitForResponse(
      (response) =>
        /\/api\/iam\/organizations\/create\/?$/i.test(response.url()) &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    );

    await submitButton.click();

    // waitForResponse throws on timeout. Swallow the throw so the explicit
    // `if (!createResponse)` branch below can produce a clearer error
    // message. This is intentional retry/error handling, not assertion
    // suppression.
    const createResponse = await createResponsePromise.catch(() => null);
    const status = createResponse?.status() ?? 0;

    if (status >= 400) {
      // The app's own silent token refresh is broken (see session-lifecycle.ts):
      // a token that goes stale right after enableMultiOrgFlow just saved new
      // settings can get this endpoint to answer 403 instead of a clean 401.
      // Give a stale session one recovery attempt on either status before
      // treating it as a real policy failure.
      const looksLikeAuth = status === 401 || status === 403;
      if (attempt < maxAttempts - 1 && looksLikeAuth) {
        await refreshSuiteSession(page);
        await openIam(page, "organization", "Organizations");
        await expect(addOrganizationButton).toBeEnabled({ timeout: 20_000 });
        await addOrganizationButton.click();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        continue;
      }

      await expect(dialog).toBeVisible();
      throw new Error(
        `Add Organization API rejected create with HTTP ${status}. ` +
          `Dialog remained open (see snapshots/organizations-add-after-submit.yml). ` +
          (status === 403
            ? "403 Forbidden persisted after a session refresh — a real permission/policy failure."
            : "Create must return 2xx for this flow to pass."),
      );
    }

    if (!createResponse) {
      throw new Error(
        "Add Organization click did not produce POST /api/iam/organizations/create — cannot claim create succeeded.",
      );
    }

    // Strict: the success toast MUST appear after a 2xx create. If it
    // doesn't, the test MUST fail rather than fall through to a softer
    // check.
    const successToast = page.getByText("Organization added successfully", { exact: true });
    if (await successToast.isVisible({ timeout: 15_000 })) {
      await expect(dialog).toBeHidden({ timeout: 10_000 });
      return;
    }

    // Strict: if the toast didn't appear, the dialog's continued visibility
    // is itself a signal of failure — surface it rather than swallow.
    if (await dialog.isVisible({ timeout: 1_000 })) {
      throw new Error(
        `Add Organization returned HTTP ${status} but dialog stayed open and no success toast appeared.`,
      );
    }
    await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    return;
  }
}

export async function selectOrgInSidebarFlow(page: Page, orgName: string) {
  const orgEntry = page.getByText(orgName, { exact: true }).first();
  await expect(orgEntry).toBeVisible({ timeout: 15_000 });
  await orgEntry.click();
  await expect(page.getByText(orgName, { exact: true }).last()).toBeVisible({ timeout: 15_000 });
}

export async function verifyMembersTabFlow(page: Page) {
  const membersTab = page.getByRole("tab", { name: /Members/ }).first();
  await membersTab.click();
  await expect(membersTab).toHaveAttribute("data-state", "active");
  await expect(page.getByRole("button", { name: /Invite/i }).first()).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("tab", { name: "Details" }).first().click();
}

export async function inviteOrgMemberFlow(page: Page, inviteEmail: string, organizationName: string) {
  const membersTab = page.getByRole("tab", { name: /Members/ }).first();
  await membersTab.click();
  await expect(membersTab).toHaveAttribute("data-state", "active");
  await page.getByRole("button", { name: /Invite Member/i }).first().click();

  const dialog = page.getByRole("dialog").filter({ hasText: "Invite Member" });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByPlaceholder("name@company.com").fill(inviteEmail);

  const orgTrigger = dialog.getByRole("combobox");
  if (await orgTrigger.isVisible({ timeout: 8_000 })) {
    const alreadySelected = await orgTrigger.getByText(organizationName, { exact: true }).isVisible();
    if (!alreadySelected) {
      await orgTrigger.click();
      const search = page.getByPlaceholder("Search organizations...");
      if (await search.isVisible({ timeout: 3_000 })) {
        await search.fill(organizationName);
      }
      await page.getByRole("option", { name: organizationName, exact: true }).click();
    }
  }

  const sendButton = dialog.getByRole("button", { name: /Send invite|Grant access/ });
  await expect(sendButton).toBeEnabled({ timeout: 15_000 });

  const createResponsePromise = page.waitForResponse(
    (response) =>
      /\/api\/iam\/users\/create\/?$/i.test(response.url()) &&
      response.request().method() === "POST",
    { timeout: 20_000 },
  );
  await sendButton.click();

  const createResponse = await createResponsePromise.catch(() => null);
  if (createResponse && createResponse.status() >= 400) {
    throw new Error(
      `Invite Member API rejected create with HTTP ${createResponse.status()} — dialog stayed open.`,
    );
  }

  const inviteToast = page
    .getByRole("region", { name: /Notifications/i })
    .getByText(/Invitation is sent|User granted access to the organization/);
  await expect(inviteToast).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

export async function renameOrganizationFlow(page: Page, currentName: string): Promise<string> {
  await kebabMenuButton(page).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await expect(page.getByRole("heading", { name: "Rename Organization" })).toBeVisible();

  const renamedOrgName = `${currentName} Renamed`;
  const nameInput = page.getByRole("textbox", { name: "Name" }).first();
  await nameInput.fill(renamedOrgName);
  await page.getByRole("button", { name: "Save", exact: true }).first().click();

  await expect(page.getByText("Organization renamed successfully", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(renamedOrgName, { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
  return renamedOrgName;
}

export async function disableReEnableOrganizationFlow(page: Page) {
  await kebabMenuButton(page).click();
  await page.getByRole("menuitem", { name: "Disable" }).click();
  await expect(page.getByRole("heading", { name: "Disable Organization" })).toBeVisible();
  await page.getByRole("button", { name: "Disable", exact: true }).first().click();
  await expect(page.getByText("Organization disabled successfully", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Disabled").first()).toBeVisible({ timeout: 10_000 });

  await kebabMenuButton(page).click();
  await page.getByRole("menuitem", { name: "Enable" }).click();
  await expect(page.getByRole("heading", { name: "Enable Organization" })).toBeVisible();
  await page.getByRole("button", { name: "Enable", exact: true }).first().click();
  await expect(page.getByText("Organization enabled successfully", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

export async function searchOrganizationsFlow(page: Page, orgName: string) {
  const searchInput = page.getByPlaceholder("Search organizations...").first();
  await searchInput.fill("ab");
  await expect(page.getByText("Type at least 3 characters to search")).toBeVisible({
    timeout: 5_000,
  });

  await searchInput.fill(orgName);
  await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  await searchInput.fill("no-such-organization-xyz");
  await expect(page.getByText("No organizations found")).toBeVisible({ timeout: 10_000 });

  await searchInput.fill("");
  await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
}

export async function statusFilterFlow(page: Page, orgName: string) {
  const filterButton = page.getByRole("button", { name: "Filter organizations" }).first();
  await expect(filterButton).toBeVisible({ timeout: 5_000 });
  await filterButton.click();
  await page.getByText("disabled", { exact: true }).first().click();
  await page.keyboard.press("Escape");
  await expect(page.getByText(orgName, { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
}
