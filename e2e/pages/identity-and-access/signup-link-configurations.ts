import { expect, type Locator, type Page, type Request } from "@playwright/test";
import { openIam } from "../../support/os-helpers";

/** The page heading is served by localization; dev currently shows "One-Click Signup". */
export const SIGNUP_LINK_CONFIGURATIONS_HEADING = /^(One-Click Signup|Signup Link Configurations)$/;

export const EXISTING_USER_WARNING =
  "Anyone who can generate links from this configuration will be able to sign in as an existing user without their password.";

export async function navigateToSignupLinkConfigurationsFlow(page: Page) {
  await openIam(page, "signup-link-configurations", SIGNUP_LINK_CONFIGURATIONS_HEADING);
  await expect(
    page.getByRole("heading", { level: 1, name: SIGNUP_LINK_CONFIGURATIONS_HEADING }),
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

/**
 * Picks the first eligible OIDC client through the Client select, then its first registered
 * redirect URI when the redirect select is shown and still empty.
 */
export async function chooseFirstClientFlow(page: Page) {
  await page.getByTestId("client-select").click();
  await page.getByRole("option").first().click();
  const redirect = page.getByTestId("redirect-select");
  if (await redirect.isVisible().catch(() => false)) {
    if ((await redirect.textContent())?.includes("Select a registered redirect URI")) {
      await redirect.click();
      await page.getByRole("option").first().click();
    }
  } else {
    await page
      .getByPlaceholder("https://example.com/callback")
      .fill("https://example.com/callback");
  }
}

export async function selectOptionFlow(page: Page, testId: string, option: string) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

export async function createConfigurationFlow(page: Page, opts: { name: string }) {
  await page.getByPlaceholder("Partner onboarding").fill(opts.name);
  await chooseFirstClientFlow(page);
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

/** Cleanup: archives the named configuration if it is still active. */
export async function archiveIfPresentFlow(page: Page, name: string) {
  const button = page.getByRole("button", { name: `Archive configuration ${name}` });
  if (!(await button.isVisible().catch(() => false))) return;
  await button.click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByText("Archive this configuration?")).toBeHidden({ timeout: 15_000 });
}

export async function showArchivedFlow(page: Page) {
  await page.getByText("Show archived").click();
  await expect(page).toHaveURL(/includeInactive=true/);
}

// ---- #645: existing-user password switch and Max redemptions ----

export function requireExistingUserPasswordSwitch(page: Page): Locator {
  return page.getByRole("switch", { name: "Existing users must confirm their password" });
}

export function maxRedemptionsInput(page: Page): Locator {
  return page.getByTestId("default-max-redemptions");
}

export function existingUserWarning(page: Page): Locator {
  return page.getByRole("alert").filter({ hasText: EXISTING_USER_WARNING });
}

export async function setRequireExistingUserPasswordFlow(page: Page, on: boolean) {
  const control = requireExistingUserPasswordSwitch(page);
  if ((await control.getAttribute("aria-checked")) !== String(on)) await control.click();
  await expect(control).toHaveAttribute("aria-checked", String(on));
}

/** Create is POST /configurations; update is PATCH /configurations/{itemId}. */
const isConfigurationWrite = (req: Request, method: "POST" | "PATCH") => {
  if (req.method() !== method) return false;
  const path = new URL(req.url()).pathname;
  return method === "POST"
    ? /\/signup-links\/configurations\/?$/.test(path)
    : /\/signup-links\/configurations\/[^/]+\/?$/.test(path);
};

/** Resolves with the JSON body of the next configuration create (POST) or update (PATCH). */
export function nextConfigurationWrite(
  page: Page,
  method: "POST" | "PATCH",
): Promise<Record<string, unknown>> {
  return page
    .waitForRequest((req) => isConfigurationWrite(req, method), { timeout: 20_000 })
    .then((req) => req.postDataJSON() as Record<string, unknown>);
}

/** Counts configuration creates and updates sent from now on. */
export function countConfigurationWrites(page: Page): { count: () => number } {
  let writes = 0;
  page.on("request", (req) => {
    if (isConfigurationWrite(req, "POST") || isConfigurationWrite(req, "PATCH")) writes += 1;
  });
  return { count: () => writes };
}

export function configurationRow(page: Page, name: string): Locator {
  return page.locator('[data-testid^="configuration-row-"]').filter({ hasText: name });
}

export async function expectConfigurationRowFlow(
  page: Page,
  name: string,
  cells: { maxUses: string; existingUserPassword: string },
) {
  const row = configurationRow(page, name);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.getByTestId("max-uses")).toHaveText(cells.maxUses);
  await expect(row.getByTestId("existing-user-password")).toHaveText(cells.existingUserPassword);
}

export async function openEditConfigurationFlow(page: Page, name: string) {
  await page.getByRole("button", { name: `Edit configuration ${name}` }).click();
  await expect(page.getByRole("heading", { name: "Update Configuration" })).toBeVisible();
}

/**
 * Reading the stored switch back needs blocks-iam#593 (requireExistingUserPassword,
 * SPEC27) on the IAM this preview calls. The OS preview's CSP only allows the
 * shared dev-iam, which drops the field until #593 is deployed there.
 *
 * While IAM omits the field, fill it into IAM's query/get responses for the one
 * configuration this test created, with the value the test sent. That keeps the
 * OS list and edit rendering under test. Once dev-iam returns the field, the
 * real value passes through untouched and this does nothing.
 *
 * Returns how many responses were filled in, so the test can record whether it
 * ran against the real stored value.
 */
export async function fillStoredSwitchWhileIamOmitsIt(
  page: Page,
  name: string,
  value: boolean,
): Promise<{ filled: () => number }> {
  let filled = 0;
  const fill = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(fill);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.name === name && record.requireExistingUserPassword == null) {
      record.requireExistingUserPassword = value;
      filled += 1;
    }
    Object.values(record).forEach(fill);
  };

  await page.route(/\/signup-links\/configurations\/(query|[^/?]+)\/?(\?.*)?$/, async (route) => {
    const request = route.request();
    const isRead =
      (request.method() === "POST" && /\/configurations\/query/.test(request.url())) ||
      request.method() === "GET";
    // Only API reads; a document navigation to a matching app URL passes through.
    const isApi = ["fetch", "xhr"].includes(request.resourceType());
    if (!isRead || !isApi) return route.fallback();
    try {
      const response = await route.fetch();
      const text = await response.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return await route.fulfill({ response, body: text });
      }
      fill(body);
      return await route.fulfill({ response, json: body });
    } catch {
      // The page navigated away while the read was in flight, so the response
      // was disposed and nothing is waiting for it.
      return undefined;
    }
  });

  return { filled: () => filled };
}
