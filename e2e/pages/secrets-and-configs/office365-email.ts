import { expect, type Page } from "@playwright/test"

/**
 * The SMTP Office 365 configuration flows.
 *
 * Browser-observable only, and deliberately so: the suite has no authenticated
 * API-request helper, and the Duplicate endpoint has no UI at all. The raw-API
 * parts of the contract — inbound rejection, a missing tenant id, duplicate
 * without a new secret, and the compensation paths — are covered by the server
 * test suite, where the vault can be faked.
 */

const OFFICE_365 = "SMTP Office 365"

function dialogProviderSelect(page: Page) {
  return page.getByRole("dialog").getByRole("combobox").nth(1)
}

function dialogTypeSelect(page: Page) {
  return page.getByRole("dialog").getByRole("combobox").first()
}

/** H1 / C1: offered for outbound, absent for inbound. */
export async function verifyOffice365OfferedForOutboundOnlyFlow(page: Page) {
  await dialogProviderSelect(page).click()
  await expect(page.getByRole("option", { name: OFFICE_365 })).toBeVisible()
  await expect(page.getByRole("option", { name: "Amazon SES" })).toBeVisible()
  await expect(page.getByRole("option", { name: "Zoho" })).toBeVisible()
  await page.keyboard.press("Escape")

  await dialogTypeSelect(page).click()
  await page.getByRole("option", { name: "Inbound" }).click()

  await dialogProviderSelect(page).click()
  await expect(page.getByRole("option", { name: OFFICE_365 })).toHaveCount(0)
  await page.keyboard.press("Escape")

  await dialogTypeSelect(page).click()
  await page.getByRole("option", { name: "Outbound" }).click()
}

/** H1: read-only transport, no password controls, OAuth fields present. */
export async function selectOffice365AndVerifyFormFlow(page: Page) {
  await dialogProviderSelect(page).click()
  await page.getByRole("option", { name: OFFICE_365 }).click()

  const host = page.getByPlaceholder("Enter Host")
  const port = page.getByPlaceholder("Enter port")
  await expect(host).toHaveValue("smtp.office365.com")
  await expect(port).toHaveValue("587")
  await expect(host).toHaveAttribute("readonly", "")
  await expect(port).toHaveAttribute("readonly", "")

  await expect(page.getByPlaceholder("Enter sender username")).toHaveCount(0)
  await expect(page.getByPlaceholder("Enter password")).toHaveCount(0)
  await expect(page.getByRole("dialog").getByText("Enable SSL")).toHaveCount(0)

  await expect(page.getByPlaceholder("Enter Microsoft Entra tenant ID")).toBeVisible()
  await expect(page.getByPlaceholder("Enter client ID")).toBeVisible()
  await expect(page.getByPlaceholder("Enter client secret")).toBeVisible()
  await expect(page.getByPlaceholder("Enter mailbox address")).toBeVisible()

  // C2: Save stays disabled while a required value is blank or invalid.
  const saveButton = page.getByRole("button", { name: "Save", exact: true })
  await expect(saveButton).toBeDisabled()

  await page.getByPlaceholder("Enter mailbox address").fill("not-an-email")
  await expect(page.getByText("Mailbox address must be a valid email")).toBeVisible()
  await expect(saveButton).toBeDisabled()
  await page.getByPlaceholder("Enter mailbox address").fill("")
}

/**
 * H2: save, then check the response itself carries no secret material. The
 * response is the only place a leak would show — the details view below reads
 * from it, so asserting on the rendered text alone would not prove anything.
 */
export async function fillAndSaveOffice365ConfigFlow(
  page: Page,
  configName: string,
  clientSecret: string,
) {
  await page.getByPlaceholder("Enter name").fill(configName)
  await page.getByPlaceholder("Enter sender name").fill("Contoso Notifications")
  await page
    .getByPlaceholder("Enter sender address")
    .fill(`o365-sender-${Date.now()}@example.com`)
  await page.getByPlaceholder("Enter Microsoft Entra tenant ID").fill("contoso-tenant")
  await page.getByPlaceholder("Enter client ID").fill("mailer-app")
  await page.getByPlaceholder("Enter mailbox address").fill("mailer@example.com")
  await page.getByPlaceholder("Enter client secret").fill(clientSecret)

  const saveButton = page.getByRole("button", { name: "Save", exact: true })
  await expect(saveButton).toBeEnabled({ timeout: 10000 })

  const [saveResponse] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes("/Mail/Save") && response.request().method() === "POST",
      { timeout: 20000 },
    ),
    saveButton.click(),
  ])

  expect(saveResponse.status()).toBe(200)
  const saveBody = await saveResponse.text()
  expect(saveBody).not.toContain(clientSecret)
  expect(saveBody.toLowerCase()).not.toContain("clientsecretreference")
  expect(JSON.parse(saveBody).itemId).toBeTruthy()

  await expect(page.getByText("Configuration created successfully.")).toBeVisible({
    timeout: 15000,
  })
}

/** H3: the exact label, the normalized transport, and the secret as a flag. */
export async function expandOffice365RowAndVerifyFlow(
  page: Page,
  configName: string,
  clientSecret: string,
) {
  const listResponse = await page.waitForResponse(
    (response) => response.url().includes("/Mail/Gets"),
    { timeout: 20000 },
  )
  const listBody = await listResponse.text()
  expect(listBody).not.toContain(clientSecret)
  expect(listBody.toLowerCase()).not.toContain("clientsecretreference")

  const configTrigger = page.getByRole("button", { name: configName })
  await expect(configTrigger).toBeVisible({ timeout: 15000 })
  await configTrigger.click()

  const panel = page.getByLabel(configName)
  await expect(panel.getByText(OFFICE_365)).toBeVisible({ timeout: 10000 })
  await expect(panel.getByText("smtp.office365.com")).toBeVisible()
  await expect(panel.getByText("587")).toBeVisible()
  await expect(panel.getByText("Outbound")).toBeVisible()
  await expect(panel.getByText("contoso-tenant")).toBeVisible()
  await expect(panel.getByText("mailer-app")).toBeVisible()
  await expect(panel.getByText("mailer@example.com")).toBeVisible()
  await expect(panel.getByText("Configured", { exact: true })).toBeVisible()

  // The password mask belongs to the password providers and must not appear here:
  // it is a value a caller could post straight back.
  await expect(panel.getByText("*********************")).toHaveCount(0)
}

/** H4: a blank secret keeps the one on file. */
export async function editOffice365KeepingSecretFlow(page: Page, newSenderName: string) {
  await page.getByRole("button", { name: "Edit", exact: true }).first().click()
  await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible()

  const secretField = page.getByPlaceholder("Leave blank to keep the current secret")
  await expect(secretField).toBeVisible()
  await expect(secretField).toHaveValue("")

  await page.getByPlaceholder("Enter sender name").fill(newSenderName)

  const updateButton = page.getByRole("button", { name: "Update Changes" })
  await expect(updateButton).toBeEnabled({ timeout: 10000 })
  await updateButton.click()

  await expect(page.getByText("Configuration updated successfully.")).toBeVisible({
    timeout: 15000,
  })
}

/** C2: whitespace is a mistake, not a preserve. */
export async function verifyOffice365BlankSecretRejectedFlow(page: Page) {
  await page.getByRole("button", { name: "Edit", exact: true }).first().click()
  await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible()

  await page.getByPlaceholder("Leave blank to keep the current secret").fill("   ")
  await expect(page.getByText("Client secret must not be blank")).toBeVisible()
  await expect(page.getByRole("button", { name: "Update Changes" })).toBeDisabled()

  await page.getByRole("button", { name: "Cancel" }).click()
}

/** H4 / C3: a replacement rotates, and nothing in the response carries it. */
export async function editOffice365RotatingSecretFlow(page: Page, replacementSecret: string) {
  await page.getByRole("button", { name: "Edit", exact: true }).first().click()
  await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible()

  await page.getByPlaceholder("Leave blank to keep the current secret").fill(replacementSecret)

  const updateButton = page.getByRole("button", { name: "Update Changes" })
  await expect(updateButton).toBeEnabled({ timeout: 10000 })

  const [saveResponse] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes("/Mail/Save") && response.request().method() === "POST",
      { timeout: 20000 },
    ),
    updateButton.click(),
  ])

  expect(saveResponse.status()).toBe(200)
  expect(await saveResponse.text()).not.toContain(replacementSecret)

  await expect(page.getByText("Configuration updated successfully.")).toBeVisible({
    timeout: 15000,
  })

  // Reopening proves the record still reports a secret on file after a rotation.
  await page.getByRole("button", { name: "Edit", exact: true }).first().click()
  await expect(page.getByPlaceholder("Leave blank to keep the current secret")).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
}
