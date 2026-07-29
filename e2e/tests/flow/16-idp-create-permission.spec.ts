import { test, expect } from "../../support/test-base";
import { openIdpPage } from "../../support/steps/idp.steps";
import { randomToken } from "../../support/flow-state";

// Real mutation-and-verify test: fills the New Permission form, submits, and
// confirms the created permission actually persisted (redirect + list row).
test("16 - create a new permission (IDP)", async ({ page }) => {
  test.setTimeout(90_000);
  const itemId = await openIdpPage(page, "permission-detail/new");

  const name = `e2e-permission-${randomToken(6)}`;
  const resource = `e2e-resource-${randomToken(6)}`;
  const group = `e2e-group-${randomToken(6)}`;

  await page.getByLabel("Name").fill(name);

  await page.getByLabel("Type").click();
  await page.getByRole("option", { name: "Data protection" }).click();

  await page.getByLabel("Resource").fill(resource);

  // The Group combobox is a custom component that doesn't wire up a real
  // label-for association, so it can't be targeted with getByLabel; its
  // placeholder text is the grounded, source-confirmed selector instead.
  await page.getByText("Select or create group...").click();
  await page.getByPlaceholder("Search or create a group...").fill(group);
  await page.getByText(new RegExp(`Create group.*${group}`)).click();

  await page.getByLabel("Severity").click();
  await page.getByRole("option", { name: "Low" }).click();

  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Permission created successfully")).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForURL(new RegExp(`/app/${itemId}/idp/permissions`), { timeout: 15_000 });
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
});
