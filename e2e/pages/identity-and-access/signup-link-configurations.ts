import { expect, type Page } from "@playwright/test";
import { openIam } from "../../support/os-helpers";

export async function navigateToSignupLinkConfigurationsFlow(page: Page) {
  await openIam(page, "signup-link-configurations", "Signup Link Configurations");
  await expect(
    page.getByRole("heading", { name: "Signup Link Configurations" }),
  ).toBeVisible({ timeout: 30_000 });
}

export async function expectFirstRunEmptyOrList(page: Page) {
  const empty = page.getByText("No signup link configurations yet");
  const addButtons = page.getByRole("button", { name: "Add Configuration" });
  await expect(addButtons.first()).toBeVisible({ timeout: 30_000 });
  // Either empty state or an existing list is fine for H1; empty is Example 4.
  if (await empty.isVisible().catch(() => false)) {
    await expect(empty).toBeVisible();
  }
}

export async function openAddConfigurationDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Add Configuration" }).first().click();
  await expect(page.getByRole("heading", { name: "Add Configuration" })).toBeVisible();
}

export async function clientSideRequiredValidationFlow(page: Page) {
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Name is required")).toBeVisible();
  await expect(page.getByText("Client is required")).toBeVisible();
  await expect(page.getByText("Redirect URI is required")).toBeVisible();
}

export async function createConfigurationFlow(
  page: Page,
  opts: { name: string; clientId: string; redirectUri: string },
) {
  await page.getByPlaceholder("Partner onboarding").fill(opts.name);
  await page.getByPlaceholder("OIDC client id").fill(opts.clientId);
  await page.getByPlaceholder("https://example.com/callback").fill(opts.redirectUri);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Configuration created", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

export async function searchConfigurationFlow(page: Page, name: string) {
  const search = page.getByPlaceholder("Search...").first();
  await search.fill(name);
  await expect(page).toHaveURL(/search=/);
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
}

export async function editDescriptionOnlyFlow(page: Page, name: string, description: string) {
  await page.getByRole("button", { name: `Edit configuration ${name}` }).click();
  await expect(page.getByRole("heading", { name: "Update Configuration" })).toBeVisible();
  const desc = page.getByPlaceholder("Optional description");
  await desc.fill(description);
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByText("Configuration updated", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

export async function archiveConfigurationFlow(page: Page, name: string) {
  await page.getByRole("button", { name: `Archive configuration ${name}` }).click();
  await expect(page.getByText("Archive this configuration?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Archive this configuration?")).toBeHidden({ timeout: 5_000 });

  await page.getByRole("button", { name: `Archive configuration ${name}` }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByText("Configuration archived", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

export async function showArchivedFlow(page: Page) {
  await page.getByText("Show archived").click();
  await expect(page).toHaveURL(/includeInactive=true/);
}
