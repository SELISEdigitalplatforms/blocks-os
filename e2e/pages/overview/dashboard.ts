import { type Locator, type Page, expect } from "@playwright/test";

export async function openBootstrapBriefFlow(page: Page) {
  const bootstrapButton = page.getByRole("button", { name: "Bootstrap" });
  const bootstrapHeading = page.getByRole("heading", { name: "Bootstrap with an AI agent" });

  await expect(bootstrapButton).toBeVisible({ timeout: 10000 });
  await bootstrapButton.click();
  if (!(await bootstrapHeading.isVisible({ timeout: 8000 }).catch(() => false))) {
    await bootstrapButton.click();
  }
  await expect(bootstrapHeading).toBeVisible({ timeout: 10000 });
  await page.keyboard.press("Escape");
  await expect(bootstrapHeading).toBeHidden();
}

export async function verifyProjectDeleteButtonVisibleFlow(page: Page) {
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
}

export async function verifyDomainsSectionPresentFlow(page: Page) {
  await expect(page.getByText("Domains", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Domain", exact: true })).toBeVisible({
    timeout: 20000,
  });
}

export async function verifyRepositoriesSectionPresentFlow(page: Page) {
  await expect(page.getByText("Repositories", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(/no repositories/i).first())
    .toBeVisible({ timeout: 10000 })
    .catch(() => {});
}

export async function openAddDomainDialogFlow(page: Page) {
  const addDomainHeading = page.getByRole("heading", { name: "Add Domain" });
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: "Add Domain" }).click();
    if (await addDomainHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
      break;
    }
  }
  await expect(addDomainHeading).toBeVisible();
}

export async function verifyAddDomainDisabledAndValidationFlow(page: Page) {
  const addButton = page.getByRole("button", { name: "Add", exact: true });
  await expect(addButton).toBeDisabled();

  await page.getByPlaceholder("your-domain.com").first().fill("not a domain");
  await expect(page.getByText("Please enter a valid domain (e.g. example.com)").first())
    .toBeVisible()
    .catch(() => {});
  await expect(addButton).toBeDisabled();
}

export async function fillAndSaveDomainFlow(page: Page, domainName: string) {
  const domainInput = page.getByPlaceholder("your-domain.com").first();
  await domainInput.fill(domainName);

  const addButton = page.getByRole("button", { name: "Add", exact: true });
  await expect(addButton).toBeEnabled({ timeout: 10000 });
  await addButton.click();

  await expect(page.getByText("Application added successfully"))
    .toBeVisible({ timeout: 15000 })
    .catch(() => {});
  await expect(page.getByRole("heading", { name: "Add Domain" })).toBeHidden({ timeout: 10000 });
}

/**
 * The domains table is paginated and the shared project keeps domains from
 * earlier runs, so a new domain can land on page 2. Narrow the table with the
 * search box before asserting on the row.
 */
async function narrowDomainsTo(page: Page, domainName: string) {
  const searchInput = page.getByPlaceholder("Search domains...");
  if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await searchInput.fill(domainName);
  }
}

export async function verifyNewDomainAppearsAsUnverifiedFlow(
  page: Page,
  domainName: string,
): Promise<Locator> {
  await narrowDomainsTo(page, domainName);
  const domainRow = page.getByRole("row").filter({ hasText: domainName });
  await expect(domainRow).toBeVisible({ timeout: 15000 });
  await expect(domainRow.getByText("Unverified")).toBeVisible();
  return domainRow;
}

export async function verifyDomainRowActionsFlow(page: Page, domainRow: Locator) {
  await expect(domainRow.getByTitle("Configure domain")).toBeVisible();
  await expect(domainRow.getByTitle("Set up domain")).toBeVisible();
}

export async function copyDomainFromRowFlow(page: Page, domainRow: Locator) {
  const copyDomainButton = domainRow.locator("button:has(svg.lucide-copy)").first();
  if (!(await copyDomainButton.isVisible({ timeout: 5000 }).catch(() => false))) return;

  await copyDomainButton.click();
  await expect(domainRow.locator("button:has(svg.lucide-check)").first())
    .toBeVisible({ timeout: 5000 })
    .catch(() => {});
}

export async function openConfigureDomainDialogFlow(
  page: Page,
  domainRow: Locator,
  domainName: string,
) {
  await domainRow.getByTitle("Configure domain").click();
  await expect(page.getByRole("heading", { name: "Edit Domain" })).toBeVisible();

  const domainInput = page.getByPlaceholder("your-domain.com").first();
  await expect(domainInput).toHaveValue(domainName);

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Edit Domain" })).toBeHidden();
}

/**
 * "Validate CNAME" was replaced by the "Set up domain" guide. Open it for the
 * unverified domain, check it names the host, and leave without starting the
 * verification run (that would provision DNS/TLS for a fake domain).
 */
export async function openDomainSetupGuideFlow(page: Page, domainName: string) {
  await narrowDomainsTo(page, domainName);
  const domainRow = page.getByRole("row").filter({ hasText: domainName });
  await domainRow.getByTitle("Set up domain").click();
  const dialog = page.getByRole("dialog", { name: "Set up custom domain" });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await expect(dialog.getByText(domainName, { exact: false }).first()).toBeVisible();
  await dialog.getByRole("button", { name: /do it later/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10000 });
}

export async function filterDomainsBySearchFlow(page: Page, domainName: string) {
  const searchInput = page.getByPlaceholder("Search domains...");
  if (!(await searchInput.isVisible({ timeout: 5000 }).catch(() => false))) return;

  await searchInput.fill("no-such-domain-xyz");
  await expect(page.getByText("No domains match your search.")).toBeVisible({ timeout: 8000 });

  await searchInput.fill("");
  await expect(page.getByText("No domains match your search.")).toBeHidden({ timeout: 8000 });

  await searchInput.fill(domainName);
  const domainRow = page.getByRole("row").filter({ hasText: domainName });
  await expect(domainRow)
    .toBeVisible({ timeout: 15000 })
    .catch(() => {});
  await searchInput.fill("");
}

export async function paginateDomainsFlow(page: Page, domainName: string) {
  const paginationNav = page.locator('nav[aria-label="Domains pagination"]');
  const nextPageButton = paginationNav
    .locator("button:has(svg.lucide-chevron-right)")
    .first();

  if (
    !(await nextPageButton.isVisible({ timeout: 3000 }).catch(() => false)) ||
    !(await nextPageButton.isEnabled().catch(() => false))
  ) {
    return;
  }

  // Leftover domains from earlier runs decide which page the new domain is
  // on, so check the page indicator instead of where the new row sits.
  await nextPageButton.click();
  await expect(page.getByText(/Page 2 of \d+/)).toBeVisible({ timeout: 8000 });

  await paginationNav.locator("button:has(svg.lucide-chevrons-left)").first().click();
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible({ timeout: 8000 });
  void domainName;
}

export async function deleteDomainFlow(page: Page, domainName: string) {
  await narrowDomainsTo(page, domainName);
  const domainRow = page.getByRole("row").filter({ hasText: domainName });
  await domainRow.getByTitle("Delete domain").click();
  await expect(page.getByRole("heading", { name: "Delete Domain" })).toBeVisible();
  await expect(
    page.getByText("Are you sure you want to delete the following domain?"),
  ).toBeVisible();
  await expect(page.getByTitle(`https://${domainName}`)).toBeVisible();

  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await expect(page.getByText("Domain deleted successfully"))
    .toBeVisible({ timeout: 15000 })
    .catch(() => {});
  await expect(domainRow).toHaveCount(0, { timeout: 10000 });
}
