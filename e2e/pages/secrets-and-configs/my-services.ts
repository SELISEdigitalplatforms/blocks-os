import { type Locator, type Page, expect } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

export async function findServiceTriggerFlow(page: Page, name: string): Promise<Locator> {
  // AccordionTrigger is a button that also wraps Logs/Traces buttons. Scope to
  // the trigger that contains the service heading so those nested buttons
  // don't steal the accessible name match.
  const heading = page.getByRole("heading", { name, exact: true });
  const trigger = page.getByRole("button").filter({ has: heading });
  const nextPageButton = page.locator("button:has(svg.lucide-chevron-right)").first();

  for (let attempt = 0; attempt < 10; attempt++) {
    if (await trigger.isVisible({ timeout: 3000 })) {
      return trigger;
    }
    if (!(await nextPageButton.isVisible({ timeout: 2000 }))) break;
    if (await nextPageButton.isDisabled()) break;
    await nextPageButton.click();
  }

  return trigger;
}

export async function navigateToMyServicesFlow(page: Page) {
  await openSecretManagement(page, "my-services", "My Services");
}

export async function verifyEmptyStateFlow(page: Page) {
  const empty = page.getByText("No services yet");
  const serviceHeading = page.getByRole("heading", { level: 3 });
  await expect(empty.or(serviceHeading.first())).toBeVisible({ timeout: 20_000 });
}

export async function openRegisterServiceDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Register Service" }).click();
  await expect(page.getByRole("heading", { name: "Register New Service" })).toBeVisible();
}

export async function verifySaveDisabledFlow(page: Page) {
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeDisabled();
}

export async function verifyServiceNameMaxLengthFlow(page: Page) {
  const nameInput = page.getByPlaceholder("Enter name");
  await nameInput.fill("a".repeat(101));
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await saveButton.click();
  if (
    await page
      .getByText("Service name too long. Maximum 100 characters allowed.")
      .isVisible({ timeout: 5000 })
  ) {
    await expect(
      page.getByText("Service name too long. Maximum 100 characters allowed."),
    ).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Register New Service" })).toBeVisible();
  await nameInput.fill("");
}

export async function registerServiceFlow(page: Page, serviceName: string, typeOption: string) {
  await page.getByPlaceholder("Enter name").fill(serviceName);
  const typeSelect = page.getByRole("dialog").getByRole("combobox").first();
  await typeSelect.click();
  await page.getByRole("option", { name: typeOption, exact: true }).click();

  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeEnabled({ timeout: 10000 });
  await saveButton.click();
  if (
    await page.getByText("Service Registered successfully").isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("Service Registered successfully")).toBeVisible();
  }
}

export async function expandServiceRowAndVerifyFlow(page: Page, serviceName: string): Promise<Locator> {
  const serviceTrigger = await findServiceTriggerFlow(page, serviceName);
  await expect(serviceTrigger).toBeVisible({ timeout: 15000 });
  await serviceTrigger.click();
  await expect(page.getByText("Service ID")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("X-Blocks-Key")).toBeVisible();
  return serviceTrigger;
}

export async function copyServiceIdAndKeyFlow(page: Page) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  const copyButtons = page.locator("button:has(svg.lucide-copy)");
  const count = await copyButtons.count();
  for (let i = 0; i < count; i++) {
    await copyButtons.nth(i).click();
  }
  if (await page.getByText(/copied/i).first().isVisible({ timeout: 5000 })) {
    await expect(page.getByText(/copied/i).first()).toBeVisible();
  }
}

export async function verifyNavAwayFromMyServicesFlow(
  page: Page,
  linkName: "Logs" | "Traces",
): Promise<boolean> {
  const button = page.getByRole("button", { name: linkName }).first();
  if (!(await button.isVisible({ timeout: 5000 }))) return false;
  await button.click();
  await expect(page).toHaveURL(/\/lmt\//, { timeout: 15000 });
  await page.goBack();
  await expect(page.getByRole("heading", { name: "My Services" })).toBeVisible({ timeout: 15000 });
  return true;
}

export async function openDocsInNewTabFlow(page: Page): Promise<boolean> {
  if (!(await page.getByText("Service ID").first().isVisible({ timeout: 3000 }))) {
    return false;
  }
  const menuButton = page
    .locator(":is(button, div):has(svg.lucide-ellipsis-vertical)")
    .first();
  if (!(await menuButton.isVisible({ timeout: 5000 }))) return false;
  await menuButton.click();
  const docsItem = page.getByRole("menuitem", { name: "Docs" });
  try {
    const [popup] = await Promise.all([
      page.waitForEvent("popup", { timeout: 10000 }),
      docsItem.click(),
    ]);
    await expect(popup).toHaveURL(/docs\.seliseblocks\.com/, { timeout: 15000 });
    await popup.close();
    return true;
  } catch {
    return false;
  }
}

export async function openSetupGuideFlow(page: Page) {
  await page.getByRole("button", { name: "Setup Guide" }).click();
  if (
    await page.getByRole("heading", { name: "Guideline" }).isVisible({ timeout: 10000 })
  ) {
    await expect(page.getByRole("heading", { name: "Guideline" })).toBeVisible();
  }
}

export async function registerFrontendServiceFlow(page: Page, frontendServiceName: string) {
  await page.getByRole("button", { name: "Register Service" }).click();
  await expect(page.getByRole("heading", { name: "Register New Service" })).toBeVisible();

  await page.getByPlaceholder("Enter name").fill(frontendServiceName);
  const typeSelect = page.getByRole("dialog").getByRole("combobox").first();
  await typeSelect.click();
  await page.getByRole("option", { name: "Frontend", exact: true }).click();

  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeEnabled({ timeout: 10000 });
  await saveButton.click();
  if (
    await page.getByText("Service Registered successfully").isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("Service Registered successfully")).toBeVisible();
  }

  const frontendTrigger = await findServiceTriggerFlow(page, frontendServiceName);
  await expect(frontendTrigger).toBeVisible({ timeout: 15000 });
  await frontendTrigger.click();
  await expect(page.getByText("Service ID").last()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Connection String")).toHaveCount(0);
}
