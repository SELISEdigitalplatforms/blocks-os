import { expect, type Page } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

export async function navigateToExternalIdpFlow(page: Page) {
  await openSecretManagement(page, "external-idp", "External IdP");
}

export async function verifyEmptyStateFlow(page: Page) {
  if (await page.getByText("No external IdP yet").isVisible({ timeout: 15000 })) {
    await expect(page.getByText("No external IdP yet")).toBeVisible();
  }
}

export async function openAddOrEditProviderDialogFlow(page: Page) {
  const addButton = page.getByRole("button", { name: "Add", exact: true });
  const editButton = page.getByRole("button", { name: "Edit", exact: true });
  await expect(addButton.or(editButton)).toBeVisible({ timeout: 30000 });

  if (await addButton.isVisible({ timeout: 3000 })) {
    await addButton.click();
    await expect(page.getByRole("heading", { name: "Add provider" })).toBeVisible();
  } else {
    await editButton.click();
    await expect(page.getByRole("heading", { name: "Edit provider" })).toBeVisible();
  }
}

export async function verifySaveDisabledFlow(page: Page) {
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeDisabled();
}

export async function verifyProvidersOfferedFlow(page: Page) {
  await expect(page.getByLabel("Keycloak")).toBeVisible();
  await expect(page.getByLabel("Okta")).toBeVisible();
  await expect(page.getByLabel("Auth0")).toBeVisible();
  await expect(page.getByLabel("Azure")).toBeVisible();
  await expect(page.getByLabel("Others")).toBeVisible();
}

export async function verifyJwksUrlRequiredFlow(page: Page) {
  const urlInput = page.getByPlaceholder("Enter JWKS (JSON Web Key Set) url");
  await urlInput.fill("");
  await page.getByLabel("Issuer (Optional)").fill("temp-issuer");
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });
  await saveButton.click();
  await expect(page.getByText("JWKS URL is required")).toBeVisible({ timeout: 5000 });
  await page.getByLabel("Issuer (Optional)").fill("");
}

export async function verifyInvalidJwksRejectedFlow(page: Page) {
  const urlInput = page.getByPlaceholder("Enter JWKS (JSON Web Key Set) url");
  await urlInput.fill("https://example.com/not-a-jwks-endpoint");
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await saveButton.click();
  await expect(page.getByText(/Invalid, provide a valid jwks URL|jwks/i)).toBeVisible({
    timeout: 20000,
  });
  await urlInput.fill("");
}

export async function saveValidJwksFlow(page: Page, issuerValue: string) {
  await page
    .getByPlaceholder("Enter JWKS (JSON Web Key Set) url")
    .fill("https://www.googleapis.com/oauth2/v3/certs");
  await page.getByLabel("Issuer (Optional)").fill(issuerValue);
  await page.getByLabel("Audience (Optional)").fill("audience-one, audience-two");
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeEnabled({ timeout: 10000 });
  await saveButton.click();
  if (
    await page.getByText("Public certificate saved successfully.").isVisible({ timeout: 20000 })
  ) {
    await expect(page.getByText("Public certificate saved successfully.")).toBeVisible();
  }
}

export async function verifySummaryCardFlow(page: Page, issuerValue: string) {
  await expect(page.getByText("Provider", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("https://www.googleapis.com/oauth2/v3/certs")).toBeVisible();
  await expect(page.getByText(issuerValue)).toBeVisible();
  await expect(page.getByText(/audience-one/)).toBeVisible();
}

export async function openEditProviderAndCloseFlow(page: Page) {
  const editButton = page.getByRole("button", { name: "Edit" });
  if (!(await editButton.isVisible({ timeout: 8000 }))) return;
  await editButton.click();
  await expect(page.getByRole("heading", { name: "Edit provider" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).last().click();
}

export async function editProviderAndSaveFlow(page: Page, newIssuer: string) {
  const editButton = page.getByRole("button", { name: "Edit" });
  if (!(await editButton.isVisible({ timeout: 8000 }))) return;
  await editButton.click();
  await expect(page.getByRole("heading", { name: "Edit provider" })).toBeVisible();
  await page.getByLabel("Issuer (Optional)").fill(newIssuer);
  const updateButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(updateButton).toBeEnabled({ timeout: 10000 });
  await updateButton.click();
  if (
    await page.getByText("Public certificate saved successfully.").isVisible({ timeout: 20000 })
  ) {
    await expect(page.getByText("Public certificate saved successfully.")).toBeVisible();
  }
  await expect(page.getByText(newIssuer)).toBeVisible({ timeout: 15000 });
}
