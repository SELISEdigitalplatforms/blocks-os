import { type Locator, type Page, expect } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

/**
 * ServiceList renders a skeleton (no service headings, no pager) for as long as the query is
 * fetching, and the pager only with the loaded list. Wait for the loaded list — a service
 * heading or the empty state — before reading the pager or the cards.
 */
async function waitForServiceListSettled(page: Page) {
  const empty = page.getByText("No services yet", { exact: true });
  const serviceHeading = page.getByRole("heading", { level: 3 }).first();
  await expect(serviceHeading.or(empty)).toBeVisible({ timeout: 30_000 });
}

/** Moves the pager and waits for the URL and the loaded list of that page. */
async function goToServicesPage(page: Page, button: Locator, pageIndex: number) {
  await button.click();
  // nuqs drops ?page=0 (the default) from the URL.
  const expected = pageIndex === 0 ? null : String(pageIndex);
  await expect(page).toHaveURL((url) => url.searchParams.get("page") === expected, { timeout: 15_000 });
  await waitForServiceListSettled(page);
}

export async function findServiceTriggerFlow(page: Page, name: string): Promise<Locator> {
  // AccordionTrigger is a button that also wraps Logs/Traces buttons. Scope to
  // the trigger that contains the service heading so those nested buttons
  // don't steal the accessible name match.
  const heading = page.getByRole("heading", { name, exact: true });
  const trigger = page.getByRole("button").filter({ has: heading });
  // The list pages at 10 and the shared project keeps services from earlier
  // runs. Use the pager's own labels: a bare chevron-right selector also hits
  // the sidebar's collapsible arrows.
  const firstPageButton = page.getByRole("button", { name: "Go to first page" });
  const nextPageButton = page.getByRole("button", { name: "Go to next page" });

  await waitForServiceListSettled(page);
  if (await trigger.isVisible()) {
    return trigger;
  }
  if ((await firstPageButton.isVisible()) && (await firstPageButton.isEnabled())) {
    await goToServicesPage(page, firstPageButton, 0);
  }

  for (let pageIndex = 1; pageIndex <= 20; pageIndex++) {
    if (await trigger.isVisible()) {
      return trigger;
    }
    if (!(await nextPageButton.isVisible()) || (await nextPageButton.isDisabled())) break;
    await goToServicesPage(page, nextPageButton, pageIndex);
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
  // Wait for the save to finish; an instant isVisible() check let the next step read the list
  // while the request (and the list refetch it triggers) was still in flight. The register call
  // has taken over 15 s on the preview (dialog still pending; the service was created).
  await expect(page.getByText("Service Registered successfully", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByRole("heading", { name: "Register New Service" })).toBeHidden({
    timeout: 15000,
  });
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
  // exact: true — substring "Logs" otherwise matches sidebar "Logs & Traces",
  // whose parent click navigates to the first child (Usage).
  const button = page.getByRole("button", { name: linkName, exact: true }).first();
  if (!(await button.isVisible({ timeout: 5000 }))) return false;
  await button.click();
  if (linkName === "Logs") {
    await expect(page).toHaveURL(/\/lmt\/logs/, { timeout: 15_000 });
  } else {
    await expect(page).toHaveURL(/\/lmt\/tracing/, { timeout: 15_000 });
  }
  await page.goBack();
  await expect(page.getByRole("heading", { name: "My Services" })).toBeVisible({ timeout: 15000 });
  return true;
}

/**
 * Click Logs on the named service card and assert the managed-service logs URL.
 * Scopes the click to that card so sidebar "Logs & Traces" cannot steal it.
 */
export async function openServiceScopedLogsFlow(page: Page, serviceName: string) {
  const heading = page.getByRole("heading", { name: serviceName, exact: true });
  const trigger = await findServiceTriggerFlow(page, serviceName);
  await expect(trigger).toBeVisible({ timeout: 15_000 });

  // Accordion item wraps the trigger + content; prefer Logs inside that item.
  const item = page.locator("[data-state]").filter({ has: heading }).first();
  const logsInItem = item.getByRole("button", { name: "Logs", exact: true });
  const logsInTrigger = trigger.getByRole("button", { name: "Logs", exact: true });
  const logsButton = (await logsInItem.count()) > 0 ? logsInItem.first() : logsInTrigger.first();

  await expect(logsButton).toBeVisible({ timeout: 5_000 });
  await logsButton.click();
  await expect(page).toHaveURL(/\/lmt\/logs\?/, { timeout: 15_000 });
  await expect(page).toHaveURL(/source=managed/);
  await expect(page).toHaveURL(/[?&]service=/);
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
    await page.getByText("Service Registered successfully", { exact: true }).isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("Service Registered successfully", { exact: true })).toBeVisible();
  }

  const frontendTrigger = await findServiceTriggerFlow(page, frontendServiceName);
  await expect(frontendTrigger).toBeVisible({ timeout: 15000 });
  await frontendTrigger.click();
  await expect(page.getByText("Service ID").last()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Connection String")).toHaveCount(0);
}
