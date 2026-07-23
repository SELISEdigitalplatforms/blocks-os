import { test, expect } from "../../support/test-base";
import { randomLetters, requireProject } from "../../support/flow-state";

// Sequential flow — step 5: enter an environment's dashboard and add an
// application domain. The domain field rejects "@" (schema requires a real
// domain), so we use a dotted subdomain under selise.biz, e.g. abc.defgh.selise.biz.

test("05 - add an application domain in an environment", async ({ page }) => {
  const { tenantGroupId } = requireProject();

  const domain = `${randomLetters(3)}.${randomLetters(5)}.selise.biz`;

  // Enter the Development environment's dashboard (impersonation).
  await page.goto(`/app/project/${tenantGroupId}/environments`);
  await page.getByText("Development", { exact: true }).first().click();
  await page.waitForURL("**/app/*/dashboard", { timeout: 30_000 });

  // Add Domain.
  await page.getByRole("button", { name: "Add Domain" }).click();
  const dialog = page.getByRole("dialog");
  // Two inputs share the "your-domain.com" placeholder (domain + cookie domain);
  // the first is the domain field, which auto-fills the cookie domain.
  await dialog.getByPlaceholder("your-domain.com").first().fill(domain);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByText("Application added successfully")).toBeVisible({
    timeout: 30_000,
  });
});
