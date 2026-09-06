import { type Locator, type Page, expect } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

export async function navigateToCaptchaFlow(page: Page) {
  await openSecretManagement(page, "captcha", "Captcha");
  await expect(page.getByRole("button", { name: "Add Configuration" })).toBeVisible();
}

export async function clearLeftoverCaptchaConfigsFlow(page: Page) {
  for (let guard = 0; guard < 10; guard++) {
    const deleteButton = page.getByRole("button", { name: "Delete" }).first();
    if (!(await deleteButton.isVisible({ timeout: 3000 }))) break;
    await deleteButton.click();
    await expect(
      page.getByRole("heading", { name: "Delete CAPTCHA configuration?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await expect(page.getByText(/configuration deleted successfully/)).toBeVisible({
      timeout: 15000,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Add Configuration" })).toBeVisible({
      timeout: 15000,
    });
  }
}

export async function verifyEmptyCaptchaStateFlow(page: Page) {
  await expect(page.getByText("Captcha is not configured"))
    .toBeVisible({ timeout: 10000 })
    .catch(() => {});
}

export async function openAddCaptchaDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Add Configuration" }).click();
  await expect(page.getByRole("heading", { name: "Add Captcha Configuration" })).toBeVisible();
}

export async function verifyStrictValidationFlow(page: Page) {
  const providerSelect = page.getByRole("dialog").getByRole("combobox").first();
  await providerSelect.click();
  await page.getByRole("option", { name: "Google reCAPTCHA" }).click();

  const siteKeyInput = page.getByPlaceholder("Enter site key");
  await siteKeyInput.fill("x");
  await siteKeyInput.fill("");
  if (await page.getByText("Site key is required").isVisible({ timeout: 5000 })) {
    await expect(page.getByText("Site key is required")).toBeVisible();
  }

  const secretKeyInput = page.getByPlaceholder("Enter secret key");
  await secretKeyInput.fill("x");
  await secretKeyInput.fill("");
  if (await page.getByText("Secret key is required").isVisible({ timeout: 5000 })) {
    await expect(page.getByText("Secret key is required")).toBeVisible();
  }
}

export async function switchCaptchaGeneratorToHardFlow(page: Page) {
  const generatorSelect = page.getByRole("dialog").getByRole("combobox").nth(1);
  await generatorSelect.click();
  await page.getByRole("option", { name: "Hard" }).click();
  await expect(generatorSelect).toHaveText(/Hard/);
}

export async function fillAndSaveCaptchaFlow(page: Page, siteKey: string, secretKey: string) {
  await page.getByPlaceholder("Enter site key").fill(siteKey);
  await page.getByPlaceholder("Enter secret key").fill(secretKey);
  await page.getByRole("button", { name: "Save" }).click();
  if (await page.getByText("Captcha added successfully").isVisible({ timeout: 15000 })) {
    await expect(page.getByText("Captcha added successfully")).toBeVisible();
  }
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15000 });
}

export async function verifyProviderCardVisibleFlow(
  page: Page,
  provider: string,
): Promise<Locator> {
  const card = page.locator("div").filter({
    has: page.getByRole("heading", { name: provider }),
  });
  await expect(card.getByText("Site Key", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(card.getByText("Secret Key", { exact: true })).toBeVisible();
  return card;
}

export async function openEditCaptchaAndCloseFlow(page: Page, providerRegex: RegExp) {
  const editButton = page.getByRole("button", { name: "Edit" }).first();
  if (!(await editButton.isVisible({ timeout: 8000 }))) return;
  await editButton.click();
  await expect(page.getByRole("heading", { name: providerRegex })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
}

export async function editCaptchaFlow(page: Page, newSiteKey: string) {
  const editButton = page.getByRole("button", { name: "Edit" }).first();
  if (!(await editButton.isVisible({ timeout: 8000 }))) return;
  await editButton.click();
  await expect(page.getByRole("heading", { name: /Edit Google reCAPTCHA/ })).toBeVisible();
  await page.getByPlaceholder("Enter site key").fill(newSiteKey);
  const updateButton = page.getByRole("button", { name: "Update Changes" });
  await expect(updateButton).toBeEnabled();
  await updateButton.click();
  if (await page.getByText("Captcha updated successfully").isVisible({ timeout: 15000 })) {
    await expect(page.getByText("Captcha updated successfully")).toBeVisible();
  }
}

export async function disableAndReenableCaptchaFlow(page: Page) {
  const disableButton = page.getByRole("button", { name: "Disable" }).first();
  if (!(await disableButton.isVisible({ timeout: 8000 }))) return;
  await disableButton.click();
  await expect(page.getByRole("heading", { name: "Disable CAPTCHA?" })).toBeVisible();
  await page.getByRole("button", { name: "Yes" }).click();
  if (await page.getByText(/is disabled successfully/).isVisible({ timeout: 15000 })) {
    await expect(page.getByText(/is disabled successfully/)).toBeVisible();
  }

  const enableButton = page.getByRole("button", { name: "Enable" }).first();
  if (!(await enableButton.isVisible({ timeout: 8000 }))) return;
  await enableButton.click();
  await expect(page.getByRole("heading", { name: "Enable CAPTCHA?" })).toBeVisible();
  await page.getByRole("button", { name: "Yes" }).click();
  if (await page.getByText(/is enabled successfully/).isVisible({ timeout: 15000 })) {
    await expect(page.getByText(/is enabled successfully/)).toBeVisible();
  }
}

export async function addSecondCaptchaProviderFlow(
  page: Page,
  providerOption: string,
  siteKey: string,
  secretKey: string,
) {
  await page.getByRole("button", { name: "Add Configuration" }).click();
  await expect(page.getByRole("heading", { name: "Add Captcha Configuration" })).toBeVisible();

  const providerSelect = page.getByRole("dialog").getByRole("combobox").first();
  await providerSelect.click();
  await page.getByRole("option", { name: providerOption }).click();

  await page.getByPlaceholder("Enter site key").fill(siteKey);
  await page.getByPlaceholder("Enter secret key").fill(secretKey);
  await page.getByRole("button", { name: "Save" }).click();
  if (await page.getByText("Captcha added successfully").isVisible({ timeout: 15000 })) {
    await expect(page.getByText("Captcha added successfully")).toBeVisible();
  }
}

export async function deleteCaptchaConfigFlow(page: Page, position: "first" | "last" = "first") {
  const deleteButton =
    position === "last"
      ? page.getByRole("button", { name: "Delete" }).last()
      : page.getByRole("button", { name: "Delete" }).first();
  if (!(await deleteButton.isVisible({ timeout: 8000 }))) return;
  await deleteButton.click();
  await expect(page.getByRole("heading", { name: "Delete CAPTCHA configuration?" })).toBeVisible();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  if (await page.getByText(/configuration deleted successfully/).isVisible({ timeout: 15000 })) {
    await expect(page.getByText(/configuration deleted successfully/)).toBeVisible();
  }
}
